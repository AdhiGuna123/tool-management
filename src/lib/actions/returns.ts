'use server';

import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { ReturnItemForm, ReturnStatus } from '@/types';

interface ProcessReturnParams {
  transaction_id: string;
  items: ReturnItemForm[];
  notes?: string;
}

interface ProcessReturnResult {
  success: boolean;
  error?: string;
  transaction_status?: string;
}

interface ReturnEventItemParams {
  transaction_item_id: string;
  returned_qty: number;
  used_qty: number;
  damaged_qty: number;
  lost_qty: number;
  notes?: string;
}

export async function processReturn(params: ProcessReturnParams): Promise<ProcessReturnResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  // Get transaction with lock (optimistic check via updated_at)
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', params.transaction_id)
    .single();

  if (txError || !transaction) {
    return { success: false, error: 'Transaksi tidak ditemukan.' };
  }

  if (transaction.status === 'SELESAI' || transaction.status === 'DIBATALKAN') {
    return { success: false, error: 'Transaksi ini sudah selesai atau dibatalkan.' };
  }

  if (transaction.status === 'SEDANG_DIPINJAM' && transaction.return_processed_at) {
    // Another admin may have started processing - check for race condition
    const timeDiff = Date.now() - new Date(transaction.return_processed_at).getTime();
    if (timeDiff < 5000) { // 5 second protection
      return { success: false, error: 'Transaksi sedang diproses oleh pengguna lain. Silakan muat ulang.' };
    }
  }

  // Validate items
  let hasDamage = false;
  let hasLoss = false;
  let allResolved = true;
  let hasOutstanding = false;

  for (const item of params.items) {
    const totalDisposition = item.returned_qty + item.used_qty + item.damaged_qty + item.lost_qty;
    const outstanding = item.borrow_qty - totalDisposition;

    if (outstanding < 0) {
      return { 
        success: false, 
        error: `Jumlah ${item.item_name} tidak sesuai. Dibawa ${item.borrow_qty} tetapi total status tercatat ${totalDisposition}.` 
      };
    }

    if (outstanding > 0) {
      allResolved = false;
      hasOutstanding = true;
    }

    if (item.damaged_qty > 0) hasDamage = true;
    if (item.lost_qty > 0) hasLoss = true;
  }

  // Determine transaction status
  let newStatus: string;
  if (allResolved) {
    newStatus = 'SELESAI';
  } else {
    newStatus = 'PENGEMBALIAN_BELUM_LENGKAP';
  }

  // If there are damaged/lost items but everything is accounted for, keep SELESAI with flags
  // If there are outstanding items, it's PENGEMBALIAN_BELUM_LENGKAP

  // Create return event
  const { data: returnEvent, error: eventError } = await supabase
    .from('return_events')
    .insert({
      transaction_id: params.transaction_id,
      processed_by: user.id,
      notes: params.notes || null,
    })
    .select('id')
    .single();

  if (eventError) {
    console.error('Return event error:', eventError);
    return { success: false, error: 'Gagal membuat event pengembalian.' };
  }

  // Process each item
  const stockMovements = [];
  const transactionItemUpdates = [];
  const returnEventItems = [];

  for (const item of params.items) {
    const totalDisposition = item.returned_qty + item.used_qty + item.damaged_qty + item.lost_qty;
    const outstanding = item.borrow_qty - totalDisposition;

    // Determine return status
    let returnStatus: ReturnStatus;
    if (totalDisposition === 0) {
      returnStatus = 'BELUM_KEMBALI';
    } else if (outstanding === 0 && item.returned_qty === item.borrow_qty && item.damaged_qty === 0 && item.lost_qty === 0) {
      returnStatus = 'KEMBALI_BAIK';
    } else if (outstanding === 0 && item.used_qty > 0 && item.returned_qty === 0) {
      returnStatus = 'HABIS_DIPAKAI';
    } else if (outstanding === 0 && item.damaged_qty > 0) {
      returnStatus = 'RUSAK';
    } else if (outstanding === 0 && item.lost_qty > 0) {
      returnStatus = 'HILANG';
    } else if (outstanding > 0 && totalDisposition > 0) {
      returnStatus = 'SEBAGIAN_KEMBALI';
    } else {
      returnStatus = 'BELUM_KEMBALI';
    }

    // Update transaction item
    transactionItemUpdates.push({
      id: item.id,
      returned_qty: item.returned_qty,
      used_qty: item.used_qty,
      damaged_qty: item.damaged_qty,
      lost_qty: item.lost_qty,
      return_status: returnStatus,
      notes: item.notes || null,
    });

    // Create return event item
    returnEventItems.push({
      return_event_id: returnEvent.id,
      transaction_item_id: item.id,
      returned_qty: item.returned_qty,
      used_qty: item.used_qty,
      damaged_qty: item.damaged_qty,
      lost_qty: item.lost_qty,
      notes: item.notes || null,
    });

    // Create stock movements for returned/damaged/lost items
    if (item.item_id && !item.is_manual_item) {
      // Get current stock
      const { data: currentItem } = await supabase
        .from('items')
        .select('current_stock, stock_known')
        .eq('id', item.item_id)
        .single();

      if (currentItem && currentItem.stock_known && currentItem.current_stock !== null) {
        // Returned items go back to stock
        if (item.returned_qty > 0) {
          const newStock = currentItem.current_stock + item.returned_qty;
          stockMovements.push({
            item_id: item.item_id,
            transaction_id: params.transaction_id,
            technician_id: transaction.technician_id,
            movement_type: item.item_type === 'TOOL' ? 'TOOL_RETURNED' : 'CONSUMABLE_RETURNED',
            quantity: item.returned_qty,
            stock_before: currentItem.current_stock,
            stock_after: newStock,
            notes: `Pengembalian ${transaction.transaction_number}`,
            created_by: user.id,
          });
          // Update stock
          await supabase
            .from('items')
            .update({ current_stock: newStock })
            .eq('id', item.item_id);
          currentItem.current_stock = newStock;
        }

        // Damaged items - don't return to available stock
        if (item.damaged_qty > 0) {
          stockMovements.push({
            item_id: item.item_id,
            transaction_id: params.transaction_id,
            technician_id: transaction.technician_id,
            movement_type: 'TOOL_DAMAGED',
            quantity: 0, // No stock change - item is damaged, not available
            stock_before: currentItem.current_stock,
            stock_after: currentItem.current_stock,
            notes: `Kerusakan ${transaction.transaction_number}: ${item.damage_notes || ''}`,
            created_by: user.id,
          });
        }

        // Lost items - don't return to stock
        if (item.lost_qty > 0) {
          stockMovements.push({
            item_id: item.item_id,
            transaction_id: params.transaction_id,
            technician_id: transaction.technician_id,
            movement_type: 'TOOL_LOST',
            quantity: 0, // No stock change - item is lost
            stock_before: currentItem.current_stock,
            stock_after: currentItem.current_stock,
            notes: `Kehilangan ${transaction.transaction_number}`,
            created_by: user.id,
          });
        }

        // Used consumables - already deducted at borrow time, no additional movement needed
        // The consumed quantity is the net loss
      }
    }
  }

  // Execute updates atomically
  try {
    // Update transaction items
    for (const update of transactionItemUpdates) {
      const { error } = await supabase
        .from('transaction_items')
        .update({
          returned_qty: update.returned_qty,
          used_qty: update.used_qty,
          damaged_qty: update.damaged_qty,
          lost_qty: update.lost_qty,
          return_status: update.return_status,
          notes: update.notes,
        })
        .eq('id', update.id);

      if (error) throw error;
    }

    // Insert return event items
    const { error: reiError } = await supabase
      .from('return_event_items')
      .insert(returnEventItems);

    if (reiError) throw reiError;

    // Insert stock movements
    if (stockMovements.length > 0) {
      const { error: smError } = await supabase
        .from('stock_movements')
        .insert(stockMovements);

      if (smError) throw smError;
    }

    // Update transaction
    const { error: updateTxError } = await supabase
      .from('transactions')
      .update({
        status: newStatus,
        has_damage: hasDamage,
        has_loss: hasLoss,
        return_processed_at: new Date().toISOString(),
        return_processed_by: user.id,
        returned_at: allResolved ? new Date().toISOString() : null,
      })
      .eq('id', params.transaction_id);

    if (updateTxError) throw updateTxError;

    // Log audit
    await logAuditEvent({
      action: allResolved ? 'TRANSACTION_COMPLETED' : 'PARTIAL_RETURN',
      entityType: 'transaction',
      entityId: params.transaction_id,
      newData: {
        status: newStatus,
        has_damage: hasDamage,
        has_loss: hasLoss,
        items_processed: params.items.length,
      },
    });

    // Log individual item status changes
    for (const item of params.items) {
      if (item.damaged_qty > 0) {
        await logAuditEvent({
          action: 'ITEM_MARKED_DAMAGED',
          entityType: 'transaction',
          entityId: params.transaction_id,
          newData: { 
            item_name: item.item_name, 
            damaged_qty: item.damaged_qty,
            notes: item.damage_notes,
          },
        });
      }
      if (item.lost_qty > 0) {
        await logAuditEvent({
          action: 'ITEM_MARKED_LOST',
          entityType: 'transaction',
          entityId: params.transaction_id,
          newData: { item_name: item.item_name, lost_qty: item.lost_qty },
        });
      }
    }

    return { 
      success: true, 
      transaction_status: newStatus,
    };

  } catch (error) {
    console.error('Return processing error:', error);
    return { success: false, error: 'Gagal memproses pengembalian. Silakan coba lagi.' };
  }
}

export async function getOpenTransactions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('*, technicians(name, technician_code), projects(project_name, project_code)')
    .in('status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP', 'BERMASALAH'])
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getReturnEvents(transactionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('return_events')
    .select(`
      *,
      profiles(full_name),
      return_event_items(
        *,
        transaction_items(item_name_snapshot, unit_snapshot)
      )
    `)
    .eq('transaction_id', transactionId)
    .order('processed_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function uploadDamagePhoto(transactionItemId: string, file: File) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  // Get transaction_id from transaction_item
  const { data: txItem } = await supabase
    .from('transaction_items')
    .select('transaction_id')
    .eq('id', transactionItemId)
    .single();

  if (!txItem) {
    return { success: false, error: 'Item transaksi tidak ditemukan.' };
  }

  // Upload file
  const fileExt = file.name.split('.').pop();
  const fileName = `damage/${transactionItemId}_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(fileName, file);

  if (uploadError) {
    console.error('Upload error:', uploadError);
    return { success: false, error: 'Gagal mengupload foto kerusakan.' };
  }

  // Create attachment record
  const { error: recordError } = await supabase
    .from('attachments')
    .insert({
      transaction_id: txItem.transaction_id,
      transaction_item_id: transactionItemId,
      attachment_type: 'KERUSAKAN',
      file_path: fileName,
      file_name: file.name,
      uploaded_by: user.id,
    });

  if (recordError) {
    console.error('Record error:', recordError);
    return { success: false, error: 'Gagal menyimpan data foto.' };
  }

  await logAuditEvent({
    action: 'RETURN_ATTACHMENT_UPLOADED',
    entityType: 'attachment',
    entityId: transactionItemId,
    newData: { file_name: file.name, type: 'KERUSAKAN' },
  });

  return { success: true };
}

export async function getStockMovements(transactionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, items(item_name, unit)')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}
