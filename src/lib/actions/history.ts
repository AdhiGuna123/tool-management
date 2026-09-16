'use server';

import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

// ============================================
// DASHBOARD ACTIONS
// ============================================

export async function getDashboardStats() {
  const supabase = await createClient();

  const today = new Date().toISOString().split('T')[0];

  const [
    techniciansBorrowing,
    completedToday,
    incompleteReturns,
    damagedItems,
    unregisteredItems,
    unknownStockItems,
    todayTransactions,
    outstandingItems,
  ] = await Promise.all([
    // Teknisi sedang membawa alat
    supabase
      .from('transactions')
      .select('technician_id')
      .in('status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']),
    
    // Transaksi selesai hari ini
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'SELESAI')
      .eq('transaction_date', today),
    
    // Pengembalian belum lengkap
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENGEMBALIAN_BELUM_LENGKAP'),
    
    // Barang bermasalah (damaged atau hilang)
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('has_damage', true)
      .in('status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']),
    
    // Barang belum terdaftar (manual items)
    supabase
      .from('transaction_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_manual_item', true)
      .is('item_id', null),
    
    // Stok belum diketahui
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('stock_known', false)
      .eq('active', true),
    
    // Transaksi hari ini
    supabase
      .from('transactions')
      .select('*, technicians(name, technician_code), projects(project_name)')
      .eq('transaction_date', today)
      .order('created_at', { ascending: false }),
    
    // Outstanding items
    supabase
      .from('transaction_items')
      .select('*, transactions!inner(status, transaction_number, technician_id), technicians!inner(name)')
      .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']),
  ]);

  // Count unique technicians borrowing
  const uniqueTechnicians = new Set(
    (techniciansBorrowing.data || []).map(t => t.technician_id)
  );

  // Calculate outstanding items
  const outstandingList = (outstandingItems.data || []).filter(item => {
    const total = (item.returned_qty || 0) + (item.used_qty || 0) + (item.damaged_qty || 0) + (item.lost_qty || 0);
    return total < item.borrow_qty;
  });

  return {
    techniciansBorrowing: uniqueTechnicians.size,
    completedToday: completedToday.count || 0,
    incompleteReturns: incompleteReturns.count || 0,
    damagedItems: damagedItems.count || 0,
    unregisteredItems: unregisteredItems.count || 0,
    unknownStockItems: unknownStockItems.count || 0,
    todayTransactions: todayTransactions.data || [],
    outstandingItems: outstandingList.slice(0, 10),
  };
}

// ============================================
// TRANSACTION HISTORY ACTIONS
// ============================================

interface TransactionFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  technician_id?: string;
  project_id?: string;
  status?: string;
  issue?: string;
  page?: number;
  limit?: number;
}

export async function getTransactionHistory(filters: TransactionFilters = {}) {
  const supabase = await createClient();
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('transactions')
    .select(`
      *, 
      technicians(name, technician_code), 
      projects(project_name, project_code),
      transaction_items(item_name_snapshot, is_manual_item)
    `, { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.dateFrom) {
    query = query.gte('transaction_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('transaction_date', filters.dateTo);
  }
  if (filters.technician_id) {
    query = query.eq('technician_id', filters.technician_id);
  }
  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  // Filter by search (transaction number, technician name, project, item name)
  let filteredData = data || [];
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filteredData = filteredData.filter(tx => 
      tx.transaction_number.toLowerCase().includes(search) ||
      tx.technicians?.name?.toLowerCase().includes(search) ||
      tx.projects?.project_name?.toLowerCase().includes(search) ||
      tx.transaction_items?.some((item: { item_name_snapshot: string }) => 
        item.item_name_snapshot?.toLowerCase().includes(search)
      )
    );
  }

  // Filter by issue
  if (filters.issue) {
    filteredData = filteredData.filter(tx => {
      if (filters.issue === 'has_damage') return tx.has_damage;
      if (filters.issue === 'has_loss') return tx.has_loss;
      if (filters.issue === 'has_outstanding') return tx.status === 'PENGEMBALIAN_BELUM_LENGKAP';
      if (filters.issue === 'has_manual') return tx.transaction_items?.some((item: { is_manual_item: boolean }) => item.is_manual_item);
      if (filters.issue === 'no_issue') return !tx.has_damage && !tx.has_loss && tx.status === 'SELESAI';
      return true;
    });
  }

  return {
    data: filteredData,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getTransactionTimeline(transactionId: string) {
  const supabase = await createClient();

  const [transaction, returnEvents, attachments, stockMovements] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, technicians(name, technician_code), profiles!transactions_created_by_fkey(full_name)')
      .eq('id', transactionId)
      .single(),
    supabase
      .from('return_events')
      .select('*, profiles(full_name)')
      .eq('transaction_id', transactionId)
      .order('processed_at', { ascending: true }),
    supabase
      .from('attachments')
      .select('*, profiles(full_name)')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('stock_movements')
      .select('*, items(item_name), technicians(name)')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true }),
  ]);

  // Build timeline events
  const events = [];

  // Borrowing created
  if (transaction.data) {
    events.push({
      date: transaction.data.created_at,
      type: 'borrow',
      title: 'Pengambilan dibuat',
      description: `Oleh ${transaction.data.profiles?.full_name || 'Admin'}`,
      icon: 'borrow',
    });
  }

  // TTD uploaded
  (attachments.data || []).filter(a => a.attachment_type === 'TTD').forEach(att => {
    events.push({
      date: att.created_at,
      type: 'ttd',
      title: 'Lembar TTD diupload',
      description: att.file_name,
      icon: 'signature',
    });
  });

  // Return events
  (returnEvents.data || []).forEach(event => {
    events.push({
      date: event.processed_at,
      type: 'return',
      title: 'Pengembalian diproses',
      description: event.notes || `Oleh ${event.profiles?.full_name || 'Admin'}`,
      icon: 'return',
    });
  });

  // Stock movements
  (stockMovements.data || []).forEach(movement => {
    events.push({
      date: movement.created_at,
      type: 'stock',
      title: `Stok: ${movement.items?.item_name || 'Barang'}`,
      description: `${movement.quantity > 0 ? '+' : ''}${movement.quantity} ${movement.notes || ''}`,
      icon: 'stock',
    });
  });

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return events;
}

// ============================================
// ITEM HISTORY ACTIONS
// ============================================

export async function getItemHistory(itemId: string) {
  const supabase = await createClient();

  const [item, stockMovements, transactionItems] = await Promise.all([
    supabase.from('items').select('*').eq('id', itemId).single(),
    supabase
      .from('stock_movements')
      .select('*, transactions(transaction_number, status), technicians(name), profiles(full_name)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('transaction_items')
      .select('*, transactions(transaction_number, transaction_date, status), technicians(name)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // Get last used info
  const lastUsed = transactionItems.data?.[0];

  return {
    item: item.data,
    stockMovements: stockMovements.data || [],
    transactionItems: transactionItems.data || [],
    lastUsed: lastUsed ? {
      technician: lastUsed.technicians?.name,
      project: lastUsed.transactions?.transaction_number,
      date: lastUsed.transactions?.transaction_date,
      transactionId: lastUsed.transaction_id,
    } : null,
  };
}

export async function getItemStockSummary(itemId: string) {
  const supabase = await createClient();

  const item = await supabase.from('items').select('*').eq('id', itemId).single();
  if (!item.data) return null;

  // Count borrowed items
  const borrowed = await supabase
    .from('transaction_items')
    .select('borrow_qty, transactions!inner(status)')
    .eq('item_id', itemId)
    .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']);

  const totalBorrowed = (borrowed.data || []).reduce(
    (sum, ti) => sum + (ti.borrow_qty || 0), 0
  );

  // Count damaged items
  const damaged = await supabase
    .from('transaction_items')
    .select('damaged_qty, transactions!inner(status)')
    .eq('item_id', itemId)
    .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP', 'SELESAI']);

  const totalDamaged = (damaged.data || []).reduce(
    (sum, ti) => sum + (ti.damaged_qty || 0), 0
  );

  // Count lost items
  const lost = await supabase
    .from('transaction_items')
    .select('lost_qty, transactions!inner(status)')
    .eq('item_id', itemId)
    .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP', 'SELESAI']);

  const totalLost = (lost.data || []).reduce(
    (sum, ti) => sum + (ti.lost_qty || 0), 0
  );

  return {
    currentStock: item.data.current_stock,
    stockKnown: item.data.stock_known,
    totalBorrowed,
    totalDamaged,
    totalLost,
  };
}

// ============================================
// TECHNICIAN HISTORY ACTIONS
// ============================================

export async function getTechnicianHistory(technicianId: string) {
  const supabase = await createClient();

  const [technician, transactions, outstandingItems, defaultItems] = await Promise.all([
    supabase.from('technicians').select('*').eq('id', technicianId).single(),
    supabase
      .from('transactions')
      .select('*, projects(project_name), transaction_items(item_name_snapshot, is_manual_item)')
      .eq('technician_id', technicianId)
      .order('transaction_date', { ascending: false })
      .limit(50),
    supabase
      .from('transaction_items')
      .select('*, transactions!inner(transaction_number, transaction_date, technician_id, status)')
      .eq('transactions.technician_id', technicianId)
      .in('transactions.status', ['SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP']),
    supabase
      .from('technician_default_items')
      .select('*, items(item_name, item_type)')
      .eq('technician_id', technicianId),
  ]);

  // Filter outstanding items
  const outstanding = (outstandingItems.data || []).filter(item => {
    const total = (item.returned_qty || 0) + (item.used_qty || 0) + (item.damaged_qty || 0) + (item.lost_qty || 0);
    return total < item.borrow_qty;
  });

  // Calculate stats
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const transactionsThisMonth = (transactions.data || []).filter(
    tx => new Date(tx.transaction_date) >= thisMonth
  ).length;

  return {
    technician: technician.data,
    transactions: transactions.data || [],
    outstandingItems: outstanding,
    defaultItems: defaultItems.data || [],
    stats: {
      transactionsThisMonth,
      totalTransactions: transactions.data?.length || 0,
      outstandingCount: outstanding.length,
    },
  };
}

// ============================================
// UNREGISTERED ITEMS ACTIONS
// ============================================

interface RawManualItem {
  item_name_snapshot: string;
  unit_snapshot: string | null;
  item_type_snapshot: string;
  transaction_id: string;
  transactions?: { transaction_number: string; transaction_date: string } | null;
  technicians?: { name: string } | null;
}

export async function getUnregisteredItems() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transaction_items')
    .select(`
      item_name_snapshot,
      unit_snapshot,
      item_type_snapshot,
      transaction_id,
      transactions!inner(transaction_number, transaction_date, technician_id, status),
      technicians!inner(name)
    `)
    .eq('is_manual_item', true)
    .is('item_id', null);

  if (error) throw error;

  // Group by item name
  const grouped = (data as unknown as RawManualItem[] || []).reduce((acc, item) => {
    const name = item.item_name_snapshot;
    if (!acc[name]) {
      acc[name] = {
        name,
        unit: item.unit_snapshot,
        itemType: item.item_type_snapshot,
        usageCount: 0,
        transactions: [],
        technicians: new Set<string>(),
        lastUsedDate: null,
      };
    }
    acc[name].usageCount++;
    acc[name].transactions.push({
      transactionNumber: item.transactions?.transaction_number || '',
      date: item.transactions?.transaction_date || '',
    });
    if (item.technicians?.name) {
      acc[name].technicians.add(item.technicians.name);
    }
    if (item.transactions?.transaction_date && (!acc[name].lastUsedDate || new Date(item.transactions.transaction_date) > new Date(acc[name].lastUsedDate))) {
      acc[name].lastUsedDate = item.transactions.transaction_date;
    }
    return acc;
  }, {} as Record<string, {
    name: string;
    unit: string | null;
    itemType: string;
    usageCount: number;
    transactions: { transactionNumber: string; date: string }[];
    technicians: Set<string>;
    lastUsedDate: string | null;
  }>);

  return Object.values(grouped).map(item => ({
    ...item,
    technicians: Array.from(item.technicians),
  }));
}

// ============================================
// AUDIT LOG ACTIONS
// ============================================

interface AuditFilters {
  dateFrom?: string;
  dateTo?: string;
  user_id?: string;
  action?: string;
  entity_type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getAuditLogs(filters: AuditFilters = {}) {
  const supabase = await createClient();
  const { page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('audit_logs')
    .select('*, profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    const endDate = new Date(filters.dateTo);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt('created_at', endDate.toISOString());
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  // Filter by search
  let filteredData = data || [];
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filteredData = filteredData.filter(log =>
      log.profiles?.full_name?.toLowerCase().includes(search) ||
      log.profiles?.email?.toLowerCase().includes(search) ||
      log.action?.toLowerCase().includes(search) ||
      log.entity_type?.toLowerCase().includes(search) ||
      log.reason?.toLowerCase().includes(search)
    );
  }

  return {
    data: filteredData,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

// ============================================
// STOCK ADJUSTMENT ACTIONS
// ============================================

interface StockAdjustmentParams {
  item_id: string;
  adjustment_type: 'ADD' | 'SUBTRACT' | 'SET';
  quantity: number;
  reason: string;
}

export async function adjustStock(params: StockAdjustmentParams) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  // Check SUPER_ADMIN permission
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Hanya Super Admin yang dapat melakukan penyesuaian stok.' };
  }

  // Get current item
  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', params.item_id)
    .single();

  if (!item) {
    return { success: false, error: 'Barang tidak ditemukan.' };
  }

  if (!item.stock_known) {
    return { success: false, error: 'Stok barang ini belum diketahui. Set stok diketahui terlebih dahulu.' };
  }

  const currentStock = item.current_stock || 0;
  let newStock: number;

  switch (params.adjustment_type) {
    case 'ADD':
      newStock = currentStock + params.quantity;
      break;
    case 'SUBTRACT':
      newStock = Math.max(0, currentStock - params.quantity);
      break;
    case 'SET':
      newStock = Math.max(0, params.quantity);
      break;
    default:
      return { success: false, error: 'Tipe penyesuaian tidak valid.' };
  }

  // Update stock
  const { error: updateError } = await supabase
    .from('items')
    .update({ current_stock: newStock })
    .eq('id', params.item_id);

  if (updateError) {
    return { success: false, error: 'Gagal memperbarui stok.' };
  }

  // Create stock movement
  const quantityDiff = newStock - currentStock;
  const { error: movementError } = await supabase
    .from('stock_movements')
    .insert({
      item_id: params.item_id,
      movement_type: params.adjustment_type === 'ADD' ? 'STOCK_OPNAME_INCREASE' : 
                     params.adjustment_type === 'SUBTRACT' ? 'STOCK_OPNAME_DECREASE' : 'MANUAL_ADJUSTMENT',
      quantity: quantityDiff,
      stock_before: currentStock,
      stock_after: newStock,
      notes: params.reason,
      created_by: user.id,
    });

  if (movementError) {
    console.error('Stock movement error:', movementError);
  }

  // Log audit
  await logAuditEvent({
    action: 'STOCK_ADJUSTMENT',
    entityType: 'item',
    entityId: params.item_id,
    oldData: { current_stock: currentStock },
    newData: { current_stock: newStock, adjustment_type: params.adjustment_type, quantity: params.quantity },
    reason: params.reason,
  });

  return { success: true, oldStock: currentStock, newStock };
}

export async function setStockKnown(itemId: string, quantity: number, reason: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  // Check SUPER_ADMIN permission
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Hanya Super Admin yang dapat mengubah status stok.' };
  }

  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (!item) {
    return { success: false, error: 'Barang tidak ditemukan.' };
  }

  const { error } = await supabase
    .from('items')
    .update({ 
      stock_known: true, 
      current_stock: quantity 
    })
    .eq('id', itemId);

  if (error) {
    return { success: false, error: 'Gagal memperbarui status stok.' };
  }

  // Create stock movement
  await supabase.from('stock_movements').insert({
    item_id: itemId,
    movement_type: 'STOCK_OPNAME_INCREASE',
    quantity: quantity,
    stock_before: item.current_stock,
    stock_after: quantity,
    notes: reason || 'Stock opname pertama',
    created_by: user.id,
  });

  // Log audit
  await logAuditEvent({
    action: 'STOCK_ADJUSTMENT',
    entityType: 'item',
    entityId: itemId,
    oldData: { stock_known: false, current_stock: item.current_stock },
    newData: { stock_known: true, current_stock: quantity },
    reason: reason || 'Stock opname pertama',
  });

  return { success: true };
}

// ============================================
// CONVERT MANUAL ITEM TO MASTER
// ============================================

interface ConvertManualItemParams {
  manual_item_name: string;
  item_code?: string;
  category?: string;
  item_type: string;
  unit?: string;
  stock_known: boolean;
  current_stock?: number;
  storage_location?: string;
  notes?: string;
}

export async function convertManualItemToMaster(params: ConvertManualItemParams) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  // Check if item_code already exists
  if (params.item_code) {
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('item_code', params.item_code)
      .single();

    if (existing) {
      return { success: false, error: 'Kode barang sudah digunakan.' };
    }
  }

  // Create master item
  const { data: newItem, error } = await supabase
    .from('items')
    .insert({
      item_code: params.item_code || null,
      item_name: params.manual_item_name,
      category: params.category || null,
      item_type: params.item_type,
      unit: params.unit || null,
      stock_known: params.stock_known,
      current_stock: params.stock_known ? (params.current_stock || 0) : null,
      storage_location: params.storage_location || null,
      notes: params.notes || 'Dikonversi dari barang manual',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: 'Gagal membuat barang master.' };
  }

  // Log audit
  await logAuditEvent({
    action: 'MANUAL_ITEM_TO_MASTER',
    entityType: 'item',
    entityId: newItem.id,
    newData: {
      name: params.manual_item_name,
      code: params.item_code,
      type: params.item_type,
      source: 'manual_conversion',
    },
  });

  return { success: true, itemId: newItem.id };
}

// ============================================
// GET TECHNICIANS AND PROJECTS FOR FILTERS
// ============================================

export async function getTechniciansForFilter() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('technicians')
    .select('id, name, technician_code')
    .eq('active', true)
    .order('name');
  return data || [];
}

export async function getProjectsForFilter() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('id, project_name, project_code')
    .order('project_name');
  return data || [];
}

export async function getUsersForFilter() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name');
  return data || [];
}
