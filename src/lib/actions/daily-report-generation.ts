'use server';

import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import {
  DAILY_REPORT_TEMPLATE_PATH,
  DAILY_REPORT_TEMPLATE_MAP,
  formatIndonesianDate,
} from '@/lib/report-config';
import { readFileSync } from 'fs';

interface TransactionItemData {
  id: string;
  item_id: string | null;
  item_name_snapshot: string;
  unit_snapshot: string | null;
  borrow_qty: number;
  returned_qty: number;
  is_manual_item: boolean;
  stock_known: boolean;
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
  transaction_items: TransactionItemData[];
}

interface TechnicianBlock {
  technicianName: string;
  projectName: string;
  items: MergedItem[];
}

interface MergedItem {
  item_name: string;
  borrow_qty: number;
  returned_qty: number;
  stock_known: boolean;
  item_id: string | null;
}

interface GenerateDailyReportParams {
  reportDate: string;
  technician_id?: string;
  project_id?: string;
}

interface GenerateDailyReportResult {
  success: boolean;
  buffer?: Buffer;
  fileName?: string;
  error?: string;
}

interface DailyReportPreviewResult {
  success: boolean;
  totalTransactions?: number;
  totalTechnicians?: number;
  totalItems?: number;
  technicians?: string[];
  error?: string;
}

interface StockMapEntry {
  current_stock: number;
  stock_known: boolean;
}

async function buildStockMap(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  reportDate: string,
  itemIds: string[]
): Promise<Map<string, StockMapEntry>> {
  const stockMap = new Map<string, StockMapEntry>();

  if (itemIds.length === 0) return stockMap;

  const uniqueItemIds = [...new Set(itemIds.filter((id): id is string => id !== null))];

  for (const itemId of uniqueItemIds) {
    const { data: item } = await supabase
      .from('items')
      .select('current_stock, stock_known')
      .eq('id', itemId)
      .single();

    if (item && item.stock_known && item.current_stock !== null) {
      const { data: movements } = await supabase
        .from('stock_movements')
        .select('quantity')
        .eq('item_id', itemId)
        .gt('created_at', `${reportDate}T23:59:59`)
        .order('created_at', { ascending: true });

      let adjustment = 0;
      if (movements) {
        for (const m of movements) {
          adjustment += m.quantity;
        }
      }

      const openingStock = item.current_stock - adjustment;
      stockMap.set(itemId, {
        current_stock: openingStock,
        stock_known: true,
      });
    }
  }

  return stockMap;
}

function groupItemsByTechnician(
  transactions: TransactionData[],
  technicianFilter?: string,
  projectFilter?: string
): TechnicianBlock[] {
  const techMap = new Map<string, TechnicianBlock>();

  for (const tx of transactions) {
    if (tx.status === 'DIBATALKAN') continue;

    const techName = tx.technicians?.name || 'UNKNOWN';
    const projectName = tx.projects?.project_name || tx.manual_project_name || 'UNKNOWN';

    if (technicianFilter && techName.toUpperCase() !== technicianFilter.toUpperCase()) continue;
    if (projectFilter && projectName.toUpperCase() !== projectFilter.toUpperCase()) continue;

    if (!techMap.has(techName)) {
      techMap.set(techName, {
        technicianName: techName,
        projectName,
        items: [],
      });
    }

    const block = techMap.get(techName)!;
    for (const item of tx.transaction_items) {
      const existing = block.items.find(
        (i) => i.item_name === item.item_name_snapshot
      );

      if (existing) {
        existing.borrow_qty += item.borrow_qty;
        existing.returned_qty += item.returned_qty;
      } else {
        block.items.push({
          item_name: item.item_name_snapshot,
          borrow_qty: item.borrow_qty,
          returned_qty: item.returned_qty,
          stock_known: item.stock_known,
          item_id: item.item_id,
        });
      }
    }
  }

  return Array.from(techMap.values());
}

export async function generateDailyReport(
  params: GenerateDailyReportParams
): Promise<GenerateDailyReportResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  const { reportDate, technician_id, project_id } = params;

  let query = supabase
    .from('transactions')
    .select(`
      *,
      technicians(name, technician_code),
      projects(project_name),
      transaction_items(
        id,
        item_id,
        item_name_snapshot,
        unit_snapshot,
        borrow_qty,
        returned_qty,
        is_manual_item,
        stock_known
      )
    `)
    .eq('transaction_date', reportDate)
    .neq('status', 'DIBATALKAN');

  if (technician_id) {
    query = query.eq('technician_id', technician_id);
  }
  if (project_id) {
    query = query.eq('project_id', project_id);
  }

  const { data: transactions, error: txError } = await query;

  if (txError) {
    console.error('Fetch transactions error:', txError);
    return { success: false, error: 'Gagal mengambil data transaksi.' };
  }

  if (!transactions || transactions.length === 0) {
    return { success: false, error: 'Tidak ada transaksi untuk tanggal ini.' };
  }

  const typedTransactions = transactions as unknown as TransactionData[];

  const allItemIds: (string | null)[] = [];
  for (const tx of typedTransactions) {
    for (const item of tx.transaction_items) {
      allItemIds.push(item.item_id);
    }
  }

  const stockMap = await buildStockMap(supabase, reportDate, allItemIds as string[]);

  const technicianBlocks = groupItemsByTechnician(typedTransactions);

  if (technicianBlocks.length === 0) {
    return { success: false, error: 'Tidak ada data teknisi untuk ditampilkan.' };
  }

  const templateBuffer = readFileSync(DAILY_REPORT_TEMPLATE_PATH);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer as any);

  const ws = wb.getWorksheet('Sheet1');
  if (!ws) {
    return { success: false, error: 'Sheet1 tidak ditemukan dalam template.' };
  }

  const dateCell = ws.getCell(DAILY_REPORT_TEMPLATE_MAP.dateRow, 1);
  dateCell.value = `HARI/TGL  :   ${formatIndonesianDate(reportDate)}`;

  const { blocks, columns } = DAILY_REPORT_TEMPLATE_MAP;

  for (let i = 0; i < Math.min(technicianBlocks.length, blocks.length); i++) {
    const block = blocks[i];
    const techBlock = technicianBlocks[i];

    const projectCell = ws.getCell(block.projectRow, 1);
    projectCell.value = `NAMA PEKERJAAN :   ${techBlock.projectName}`;

    const technicianCell = ws.getCell(block.technicianCell);
    technicianCell.value = techBlock.technicianName;

    const maxRows = block.dataEndRow - block.dataStartRow + 1;
    const itemsToWrite = techBlock.items.slice(0, maxRows);

    for (let j = 0; j < itemsToWrite.length; j++) {
      const item = itemsToWrite[j];
      const row = block.dataStartRow + j;

      ws.getCell(row, columns.no).value = j + 1;
      ws.getCell(row, columns.itemName).value = item.item_name;

      if (item.item_id && item.stock_known) {
        const stockEntry = stockMap.get(item.item_id);
        if (stockEntry) {
          ws.getCell(row, columns.stock).value = stockEntry.current_stock;
        } else {
          ws.getCell(row, columns.stock).value = '';
        }
      } else {
        ws.getCell(row, columns.stock).value = '';
      }

      ws.getCell(row, columns.ambil).value = item.borrow_qty;
      ws.getCell(row, columns.kembali).value = item.returned_qty;

      const existingFormulaF = ws.getCell(row, columns.sisa).value;
      if (!existingFormulaF || typeof existingFormulaF !== 'string' || !existingFormulaF.toString().startsWith('=')) {
        const ambilVal = item.borrow_qty;
        const kembaliVal = item.returned_qty;
        ws.getCell(row, columns.sisa).value = ambilVal - kembaliVal;
      }

      const existingFormulaG = ws.getCell(row, columns.stokSore).value;
      if (!existingFormulaG || typeof existingFormulaG !== 'string' || !existingFormulaG.toString().startsWith('=')) {
        const stockVal = item.item_id && item.stock_known ? (stockMap.get(item.item_id)?.current_stock ?? 0) : 0;
        const kembaliVal = item.returned_qty;
        ws.getCell(row, columns.stokSore).value = stockVal + kembaliVal;
      }
    }

    for (let j = itemsToWrite.length; j < maxRows; j++) {
      const row = block.dataStartRow + j;
      ws.getCell(row, columns.no).value = null;
      ws.getCell(row, columns.itemName).value = null;
      ws.getCell(row, columns.stock).value = null;
      ws.getCell(row, columns.ambil).value = null;
      ws.getCell(row, columns.kembali).value = null;
      ws.getCell(row, columns.sisa).value = null;
      ws.getCell(row, columns.stokSore).value = null;
    }
  }

  for (let i = technicianBlocks.length; i < blocks.length; i++) {
    const block = blocks[i];

    const projectCell = ws.getCell(block.projectRow, 1);
    projectCell.value = `NAMA PEKERJAAN :   `;

    const technicianCell = ws.getCell(block.technicianCell);
    technicianCell.value = '';

    const maxRows = block.dataEndRow - block.dataStartRow + 1;
    for (let j = 0; j < maxRows; j++) {
      const row = block.dataStartRow + j;
      ws.getCell(row, columns.no).value = null;
      ws.getCell(row, columns.itemName).value = null;
      ws.getCell(row, columns.stock).value = null;
      ws.getCell(row, columns.ambil).value = null;
      ws.getCell(row, columns.kembali).value = null;
      ws.getCell(row, columns.sisa).value = null;
      ws.getCell(row, columns.stokSore).value = null;
    }
  }

  const buffer = (await wb.xlsx.writeBuffer()) as unknown as Buffer;

  const fileName = `LAPORAN_HARIAN_ALAT_${reportDate}.xlsx`;

  await logAuditEvent({
    action: 'CREATE_TRANSACTION',
    entityType: 'transaction',
    entityId: reportDate,
    newData: {
      type: 'DAILY_REPORT_GENERATED',
      report_date: reportDate,
      technician_count: technicianBlocks.length,
      total_items: technicianBlocks.reduce((sum, b) => sum + b.items.length, 0),
    },
  });

  return { success: true, buffer, fileName };
}

export async function getDailyReportPreview(
  params: GenerateDailyReportParams
): Promise<DailyReportPreviewResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  const { reportDate, technician_id, project_id } = params;

  let query = supabase
    .from('transactions')
    .select(`
      *,
      technicians(name, technician_code),
      projects(project_name),
      transaction_items(
        id,
        item_id,
        item_name_snapshot,
        borrow_qty,
        returned_qty
      )
    `)
    .eq('transaction_date', reportDate)
    .neq('status', 'DIBATALKAN');

  if (technician_id) {
    query = query.eq('technician_id', technician_id);
  }
  if (project_id) {
    query = query.eq('project_id', project_id);
  }

  const { data: transactions, error: txError } = await query;

  if (txError) {
    console.error('Fetch transactions error:', txError);
    return { success: false, error: 'Gagal mengambil data transaksi.' };
  }

  if (!transactions || transactions.length === 0) {
    return {
      success: true,
      totalTransactions: 0,
      totalTechnicians: 0,
      totalItems: 0,
      technicians: [],
    };
  }

  const typedTransactions = transactions as unknown as TransactionData[];
  const technicianBlocks = groupItemsByTechnician(typedTransactions);

  const totalItems = technicianBlocks.reduce((sum, b) => sum + b.items.length, 0);

  return {
    success: true,
    totalTransactions: typedTransactions.length,
    totalTechnicians: technicianBlocks.length,
    totalItems,
    technicians: technicianBlocks.map((b) => b.technicianName),
  };
}
