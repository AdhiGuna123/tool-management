'use server';

import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { TransactionItemForm } from '@/types';

interface CreateTransactionParams {
  technician_id: string;
  project_id: string | null;
  manual_project_name: string | null;
  location: string | null;
  transaction_date: string;
  notes: string | null;
  items: TransactionItemForm[];
}

interface CreateTransactionResult {
  success: boolean;
  transaction_id?: string;
  transaction_number?: string;
  error?: string;
}

async function generateTransactionNumber(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, dateStr: string): Promise<string> {
  const prefix = `ALT-${dateStr}-`;
  
  // Get the last transaction number for today
  const { data: lastTx } = await supabase
    .from('transactions')
    .select('transaction_number')
    .like('transaction_number', `${prefix}%`)
    .order('transaction_number', { ascending: false })
    .limit(1)
    .single();

  if (lastTx) {
    // Extract the sequence number and increment
    const lastSeq = parseInt(lastTx.transaction_number.split('-').pop() || '0', 10);
    const nextSeq = String(lastSeq + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  return `${prefix}001`;
}

export async function createTransaction(params: CreateTransactionParams): Promise<CreateTransactionResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('[createTransaction] auth user:', user?.id, 'authError:', authError?.message);
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi. Silakan login ulang.' };
  }

  // Auto-create profile if missing
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!existingProfile) {
    console.log('[createTransaction] profile missing, creating for user:', user.id);
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role: 'ADMIN',
        active: true,
      });
    if (profileError) {
      console.error('[createTransaction] profile create error:', profileError);
    }
  }

  // Validate technician exists and is active
  const { data: technician, error: techError } = await supabase
    .from('technicians')
    .select('id, name, active')
    .eq('id', params.technician_id)
    .maybeSingle();

  console.log('[createTransaction] technician:', technician, 'techError:', techError?.message);
  if (!technician || !technician.active) {
    return { success: false, error: 'Teknisi tidak ditemukan atau tidak aktif.' };
  }

  // Validate items
  if (!params.items || params.items.length === 0) {
    return { success: false, error: 'Minimal harus ada 1 item.' };
  }

  // Check stock for known-stock items
  for (const item of params.items) {
    if (item.item_id && item.stock_known && item.current_stock !== null) {
      if (item.borrow_qty > item.current_stock) {
        return { 
          success: false, 
          error: `Stok ${item.item_name} tidak mencukupi. Stok tersedia: ${item.current_stock}.` 
        };
      }
    }
  }

  // Generate transaction number
  const dateStr = params.transaction_date.replace(/-/g, '');
  const transaction_number = await generateTransactionNumber(supabase, dateStr);

  // Start transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      transaction_number,
      technician_id: params.technician_id,
      project_id: params.project_id || null,
      manual_project_name: params.manual_project_name || null,
      transaction_date: params.transaction_date,
      location: params.location || null,
      borrowed_at: new Date().toISOString(),
      status: 'SEDANG_DIPINJAM',
      notes: params.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (txError) {
    console.error('Transaction creation error:', txError);
    return { success: false, error: 'Gagal membuat transaksi.' };
  }

  // Create transaction items
  const transactionItems = [];
  const stockMovements = [];

  for (const item of params.items) {
    let savedItemId = item.item_id;

    // If manual item and save_to_master is checked, create master item first
    if (item.is_manual_item && item.save_to_master) {
      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert({
          item_name: item.item_name,
          category: item.category || null,
          item_type: item.item_type,
          unit: item.unit || null,
          current_stock: null,
          stock_known: false,
          notes: 'Dibuat dari transaksi pengambilan',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (newItem) {
        savedItemId = newItem.id;
        await logAuditEvent({
          action: 'MASTER_ITEM_CREATED_FROM_TRANSACTION',
          entityType: 'item',
          entityId: newItem.id,
          newData: { name: item.item_name, source: transaction_number },
        });
      }
    }

    // Create transaction item
    const txItem = {
      transaction_id: transaction.id,
      item_id: savedItemId,
      item_name_snapshot: item.item_name,
      unit_snapshot: item.unit,
      item_type_snapshot: item.item_type,
      is_default_item: item.is_default_item,
      is_manual_item: item.is_manual_item,
      borrow_qty: item.borrow_qty,
      returned_qty: 0,
      used_qty: 0,
      damaged_qty: 0,
      lost_qty: 0,
      notes: item.notes || null,
    };
    transactionItems.push(txItem);

    // Create stock movement for known-stock items with item_id
    if (savedItemId && item.stock_known && item.current_stock !== null) {
      const newStock = item.current_stock - item.borrow_qty;
      stockMovements.push({
        item_id: savedItemId,
        transaction_id: transaction.id,
        technician_id: params.technician_id,
        movement_type: item.item_type === 'TOOL' ? 'DIPINJAM' : 'KELUAR_TRANSAKSI',
        quantity: -item.borrow_qty,
        stock_before: item.current_stock,
        stock_after: newStock,
        notes: `Pengambilan ${transaction_number}`,
        created_by: user.id,
      });
    }
  }

  // Insert all transaction items
  const { error: itemsError } = await supabase
    .from('transaction_items')
    .insert(transactionItems);

  if (itemsError) {
    console.error('Transaction items error:', itemsError);
    // Rollback transaction
    await supabase.from('transactions').delete().eq('id', transaction.id);
    return { success: false, error: 'Gagal menyimpan item transaksi.' };
  }

  // Insert stock movements
  if (stockMovements.length > 0) {
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert(stockMovements);

    if (movementError) {
      console.error('Stock movement error:', movementError);
      // Don't fail the transaction, just log the error
    } else {
      // Update item stock
      for (const item of params.items) {
        if (item.item_id && item.stock_known && item.current_stock !== null) {
          const newStock = item.current_stock - item.borrow_qty;
          await supabase
            .from('items')
            .update({ current_stock: newStock })
            .eq('id', item.item_id);
        }
      }
    }
  }

  // Log audit event
  await logAuditEvent({
    action: 'CREATE_TRANSACTION',
    entityType: 'transaction',
    entityId: transaction.id,
    newData: {
      transaction_number,
      technician: technician.name,
      item_count: params.items.length,
      total_qty: params.items.reduce((sum, item) => sum + item.borrow_qty, 0),
    },
  });

  return {
    success: true,
    transaction_id: transaction.id,
    transaction_number,
  };
}

export async function cancelTransaction(transactionId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  // Get transaction details
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (!transaction) {
    return { success: false, error: 'Transaksi tidak ditemukan.' };
  }

  if (transaction.status === 'DIBATALKAN') {
    return { success: false, error: 'Transaksi sudah dibatalkan.' };
  }

  // Get transaction items for stock reversal
  const { data: items } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', transactionId);

  // Reverse stock movements
  if (items) {
    for (const item of items) {
      if (item.item_id && !item.is_manual_item) {
        // Get current stock
        const { data: currentItem } = await supabase
          .from('items')
          .select('current_stock, stock_known')
          .eq('id', item.item_id)
          .single();

        if (currentItem && currentItem.stock_known && currentItem.current_stock !== null) {
          const newStock = currentItem.current_stock + item.borrow_qty;
          
          // Create reversal movement
          await supabase.from('stock_movements').insert({
            item_id: item.item_id,
            transaction_id: transactionId,
            technician_id: transaction.technician_id,
            movement_type: 'PENGEMBALIAN_PEMBATALAN',
            quantity: item.borrow_qty,
            stock_before: currentItem.current_stock,
            stock_after: newStock,
            notes: `Pembatalan ${transaction.transaction_number}: ${reason}`,
            created_by: user.id,
          });

          // Update stock
          await supabase
            .from('items')
            .update({ current_stock: newStock })
            .eq('id', item.item_id);
        }
      }
    }
  }

  // Update transaction status
  const { error } = await supabase
    .from('transactions')
    .update({ 
      status: 'DIBATALKAN',
      notes: `${transaction.notes ? transaction.notes + '\n' : ''}Dibatalkan: ${reason}`
    })
    .eq('id', transactionId);

  if (error) {
    return { success: false, error: 'Gagal membatalkan transaksi.' };
  }

  // Log audit
  await logAuditEvent({
    action: 'CANCEL_TRANSACTION',
    entityType: 'transaction',
    entityId: transactionId,
    oldData: { status: transaction.status },
    newData: { status: 'DIBATALKAN', reason },
    reason,
  });

  return { success: true };
}

export async function getTransactions(date?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('transactions')
    .select('*, technicians(name, technician_code), projects(project_name, project_code)')
    .order('created_at', { ascending: false });

  if (date) {
    query = query.eq('transaction_date', date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getTransactionById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('*, technicians(name, technician_code), projects(project_name, project_code, location)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getTransactionItems(transactionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function uploadTTD(transactionId: string, file: File) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  // Upload file to storage
  const fileExt = file.name.split('.').pop();
  const fileName = `ttd/${transactionId}_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(fileName, file);

  if (uploadError) {
    console.error('Upload error:', uploadError);
    return { success: false, error: 'Gagal mengupload file.' };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(fileName);

  // Create attachment record
  const { error: recordError } = await supabase
    .from('attachments')
    .insert({
      transaction_id: transactionId,
      attachment_type: 'TTD',
      file_path: fileName,
      file_name: file.name,
      uploaded_by: user.id,
    });

  if (recordError) {
    console.error('Record error:', recordError);
    return { success: false, error: 'Gagal menyimpan data attachment.' };
  }

  // Log audit
  await logAuditEvent({
    action: 'UPLOAD_TTD',
    entityType: 'attachment',
    entityId: transactionId,
    newData: { file_name: file.name },
  });

  return { success: true, url: urlData.publicUrl };
}

export async function getAttachments(transactionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
