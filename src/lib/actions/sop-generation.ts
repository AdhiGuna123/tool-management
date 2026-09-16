'use server';

import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import {
  SOP_TEMPLATE_PATH,
  SOP_TEMPLATE_MAP,
  DEFAULT_SOP_SHEET_MAPPINGS,
  formatIndonesianDateParts,
} from '@/lib/report-config';
import { readFileSync } from 'fs';
import { join } from 'path';

interface TransactionItemData {
  item_name_snapshot: string;
  unit_snapshot: string | null;
  borrow_qty: number;
  returned_qty: number;
  used_qty: number;
  damaged_qty: number;
  lost_qty: number;
  is_default_item: boolean;
  is_manual_item: boolean;
}

interface TransactionData {
  id: string;
  transaction_number: string;
  transaction_date: string;
  status: string;
  technician_id: string;
  technicians: { name: string; technician_code: string } | null;
  projects: { project_name: string } | null;
  manual_project_name: string | null;
  location: string | null;
}

function getReturnKet(item: TransactionItemData): string {
  const returned = item.returned_qty || 0;
  const used = item.used_qty || 0;
  const damaged = item.damaged_qty || 0;
  const lost = item.lost_qty || 0;
  const total = returned + used + damaged + lost;
  const outstanding = item.borrow_qty - total;

  if (damaged > 0 && lost > 0) return 'RUSAK/HILANG';
  if (damaged > 0) return 'RUSAK';
  if (lost > 0) return 'HILANG';
  if (used > 0 && returned > 0) return 'SEBAGIAN DIPAKAI';
  if (used > 0 && returned === 0) return 'HABIS DIPAKAI';
  if (outstanding > 0) return 'BELUM KEMBALI';
  if (total === item.borrow_qty) return '';
  return '';
}

export async function generateSOP(transactionId: string): Promise<{ success: boolean; buffer?: Buffer; fileName?: string; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  // Fetch transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*, technicians(name, technician_code), projects(project_name)')
    .eq('id', transactionId)
    .single();

  if (txError || !transaction) {
    return { success: false, error: 'Transaksi tidak ditemukan.' };
  }

  // Fetch transaction items
  const { data: items, error: itemsError } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });

  if (itemsError || !items || items.length === 0) {
    return { success: false, error: 'Tidak ada item dalam transaksi.' };
  }

  // Get technician sheet mapping
  const techName = transaction.technicians?.name;
  if (!techName) {
    return { success: false, error: 'Teknisi tidak ditemukan.' };
  }

  // Check mapping from database first
  const { data: mapping } = await supabase
    .from('technician_report_mappings')
    .select('sheet_name')
    .eq('technician_id', transaction.technician_id)
    .eq('template_type', 'SOP_ALAT')
    .eq('active', true)
    .single();

  let sheetName: string;
  if (mapping) {
    sheetName = mapping.sheet_name;
  } else {
    // Fallback to default mapping
    const normalizedName = techName.trim().toUpperCase();
    sheetName = DEFAULT_SOP_SHEET_MAPPINGS[normalizedName];
    if (!sheetName) {
      return { success: false, error: `Template SOP untuk teknisi "${techName}" belum dikonfigurasi.` };
    }
  }

  // Read template
  const templateBuffer = readFileSync(SOP_TEMPLATE_PATH);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer as any);

  const ws = wb.getWorksheet(sheetName);
  if (!ws) {
    return { success: false, error: `Sheet "${sheetName}" tidak ditemukan dalam template.` };
  }

  // Populate date in row 3
  const dateParts = formatIndonesianDateParts(transaction.transaction_date);
  const dateCell = ws.getCell(SOP_TEMPLATE_MAP.dateRow, 1);
  dateCell.value = `Pada hari ini Tanggal ${dateParts.day}  Bulan  ${dateParts.month}  Tahun ${dateParts.year}`;

  // Update header row 29 column B to include technician name
  const headerCell = ws.getCell(SOP_TEMPLATE_MAP.headerRow1, 2);
  headerCell.value = `NAMA ALAT ${techName.toUpperCase()}`;
  
  const headerCell2 = ws.getCell(SOP_TEMPLATE_MAP.headerRow2, 2);
  headerCell2.value = `NAMA ALAT ${techName.toUpperCase()}`;

  // Clear existing tool data rows
  for (let row = SOP_TEMPLATE_MAP.toolStartRow; row <= SOP_TEMPLATE_MAP.toolEndRow; row++) {
    for (let col = 1; col <= 9; col++) {
      const cell = ws.getCell(row, col);
      if (row >= SOP_TEMPLATE_MAP.toolStartRow) {
        cell.value = null;
      }
    }
  }

  // Populate tool items
  const dataRows = items.length;
  const availableRows = SOP_TEMPLATE_MAP.maxToolRows;

  if (dataRows > availableRows) {
    // Insert additional rows while preserving formatting
    const rowsToAdd = dataRows - availableRows;
    const insertRow = SOP_TEMPLATE_MAP.toolStartRow + availableRows;
    
    for (let i = 0; i < rowsToAdd; i++) {
      ws.spliceRows(insertRow, 0, []);
      // Copy formatting from the row above
      const sourceRow = ws.getRow(insertRow - 1);
      const newRow = ws.getRow(insertRow);
      newRow.height = sourceRow.height;
      
      // Copy cell styles
      for (let col = 1; col <= 9; col++) {
        const sourceCell = sourceRow.getCell(col);
        const newCell = newRow.getCell(col);
        if (sourceCell.style) {
          newCell.style = { ...sourceCell.style };
        }
      }
    }
  }

  // Write tool data
  items.forEach((item: TransactionItemData, index: number) => {
    if (index >= SOP_TEMPLATE_MAP.maxToolRows + 10) return; // Safety limit

    const row = SOP_TEMPLATE_MAP.toolStartRow + index;
    const cols = SOP_TEMPLATE_MAP.columns;

    ws.getCell(row, cols.no).value = index + 1;
    ws.getCell(row, cols.itemName).value = item.item_name_snapshot;
    ws.getCell(row, cols.jumlahAmbil).value = item.borrow_qty;
    ws.getCell(row, cols.jumlahKembali).value = item.returned_qty || 0;
    ws.getCell(row, cols.teknisiAmbil).value = item.borrow_qty;
    ws.getCell(row, cols.teknisiKembali).value = item.returned_qty || 0;
    ws.getCell(row, cols.adminAmbil).value = item.borrow_qty;
    ws.getCell(row, cols.adminKembali).value = item.returned_qty || 0;
    ws.getCell(row, cols.ket).value = getReturnKet(item);
  });

  // Generate buffer
  const buffer = await wb.xlsx.writeBuffer() as unknown as Buffer;

  // Update transaction SOP status
  await supabase
    .from('transactions')
    .update({
      sop_generated_at: new Date().toISOString(),
      sop_generated_by: user.id,
      sop_template_version: 1,
    })
    .eq('id', transactionId);

  // Log audit
  await logAuditEvent({
    action: 'CREATE_TRANSACTION',
    entityType: 'transaction',
    entityId: transactionId,
    newData: {
      type: 'SOP_GENERATED',
      technician: techName,
      sheet_name: sheetName,
      items_count: items.length,
    },
  });

  const fileName = `SOP_ALAT_${techName.replace(/\s+/g, '_')}_${transaction.transaction_number}.xlsx`;

  return { success: true, buffer, fileName };
}

export async function getSOPSearchResults(search: string) {
  const supabase = await createClient();

  let query = supabase
    .from('transactions')
    .select('*, technicians(name, technician_code), projects(project_name)')
    .order('transaction_date', { ascending: false })
    .limit(50);

  if (search) {
    query = query.or(`transaction_number.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function getTransactionForSOP(transactionId: string) {
  const supabase = await createClient();

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*, technicians(name, technician_code), projects(project_name)')
    .eq('id', transactionId)
    .single();

  if (txError || !transaction) return null;

  const { data: items } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', transactionId);

  return {
    ...transaction,
    items: items || [],
  };
}
