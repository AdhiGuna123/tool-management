import path from 'path';

// ============================================
// TEMPLATE FILE PATHS
// ============================================
export const TEMPLATE_DIR = path.join(process.cwd(), 'templates');

export const SOP_TEMPLATE_PATH = path.join(TEMPLATE_DIR, 'SOP_ALAT_TEMPLATE.xlsx');
export const DAILY_REPORT_TEMPLATE_PATH = path.join(TEMPLATE_DIR, 'LAPORAN_HARIAN_TEMPLATE.xlsx');

// ============================================
// SOP TEMPLATE MAP
// Based on actual template analysis:
// - 8 worksheets: Dewa, Gede Budi, Mertana, Supri, TRI, Tunik, Pande, Tude
// - Row 29: Header row 1 (NO | NAMA ALAT [NAME] | JUMLAH | JUMLAH | TEKNISI | TEKNISI | ADMIN | ADMIN | KET)
// - Row 30: Header row 2 (NO | NAMA ALAT [NAME] | AMBIL | KEMBALI | AMBIL | KEMBALI | AMBIL | KEMBALI | KET)
// - Rows 31-50: Tool data area (20 rows max)
// - Row 3: Date placeholder
// - Row 58+: Signature section "Mengetahui,"
// ============================================
export const SOP_TEMPLATE_MAP = {
  // Header/date area
  dateRow: 3,
  dateCellPattern: 'Pada hari ini Tanggal            Bulan         Tah',
  
  // Table header rows
  headerRow1: 29,
  headerRow2: 30,
  
  // Data area
  toolStartRow: 31,
  toolEndRow: 50,
  maxToolRows: 20,
  
  // Column mappings (1-indexed)
  columns: {
    no: 'A',              // NO
    itemName: 'B',        // NAMA ALAT [TECHNICIAN]
    jumlahAmbil: 'C',     // JUMLAH - AMBIL
    jumlahKembali: 'D',   // JUMLAH - KEMBALI
    teknisiAmbil: 'E',    // TEKNISI - AMBIL
    teknisiKembali: 'F',  // TEKNISI - KEMBALI
    adminAmbil: 'G',      // ADMIN - AMBIL
    adminKembali: 'H',    // ADMIN - KEMBALI
    ket: 'I',             // KET (Keterangan)
  },
  
  // Signature section starts at
  signatureStartRow: 58,
  
  // SOP instruction rows (preserve as-is)
  instructionRows: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
};

// ============================================
// DAILY REPORT TEMPLATE MAP
// Based on actual template analysis:
// - Single Sheet1
// - Row 1: Title "LAPORAN HARIAN ALAT KERJA"
// - Row 2: "HARI/TGL : "
// - Each technician block:
//   - Project row: "NAMA PEKERJAAN : "
//   - Header row 1: NO | NAMA ALAT KERJA | QTY | AMBIL | KEMBALI | SISA | STOK SORE | TEKNISI
//   - Header row 2: NO | NAMA ALAT KERJA | STOK | AMBIL | KEMBALI | (D-E) | (C-F) | TEKNISI
//   - Data rows (varies, ~8-12 per block)
// - 8 technician blocks with known row ranges
// - Formulas: F=D-E (Sisa), G=C-F (Stok Sore)
// - Block 1 (DEWA): rows 7-15
// - Block 2 (GEDE BUDI): rows 20-27
// - Block 3 (MERTANA): rows 32-42
// - Block 4 (SUPRI): rows 47-56
// - Block 5 (TRI): rows 61-71
// - Block 6 (TUNIK): rows 76-81
// - Block 7 (PANDE): rows 86-97
// - Block 8 (TUDE): rows 102-113
// - Block 9 (extra): rows 118-121
// ============================================
export const DAILY_REPORT_TEMPLATE_MAP = {
  titleRow: 1,
  dateRow: 2,
  dateCellPattern: 'HARI/TGL  :',
  
  // Technician blocks (0-indexed array)
  // Each block: { projectRow, headerRow1, headerRow2, dataStartRow, dataEndRow, technicianCell }
  blocks: [
    { projectRow: 4,  headerRow1: 5,  headerRow2: 6,  dataStartRow: 7,  dataEndRow: 15, technicianCell: 'H7' },
    { projectRow: 17, headerRow1: 18, headerRow2: 19, dataStartRow: 20, dataEndRow: 27, technicianCell: 'H20' },
    { projectRow: 29, headerRow1: 30, headerRow2: 31, dataStartRow: 32, dataEndRow: 42, technicianCell: 'H32' },
    { projectRow: 44, headerRow1: 45, headerRow2: 46, dataStartRow: 47, dataEndRow: 56, technicianCell: 'H47' },
    { projectRow: 58, headerRow1: 59, headerRow2: 60, dataStartRow: 61, dataEndRow: 71, technicianCell: 'H61' },
    { projectRow: 73, headerRow1: 74, headerRow2: 75, dataStartRow: 76, dataEndRow: 81, technicianCell: 'H76' },
    { projectRow: 83, headerRow1: 84, headerRow2: 85, dataStartRow: 86, dataEndRow: 97, technicianCell: 'H86' },
    { projectRow: 99, headerRow1: 100, headerRow2: 101, dataStartRow: 102, dataEndRow: 113, technicianCell: 'H102' },
    { projectRow: 115, headerRow1: 116, headerRow2: 117, dataStartRow: 118, dataEndRow: 121, technicianCell: 'H118' },
  ],
  
  // Column mappings
  columns: {
    no: 'A',
    itemName: 'B',
    stock: 'C',
    ambil: 'D',
    kembali: 'E',
    sisa: 'F',
    stokSore: 'G',
    teknisi: 'H',
    teknisiShort: 'I',
  },
};

// ============================================
// TECHNICIAN SHEET NAME MAPPING
// Maps system technician names to Excel sheet names
// This is configurable per-deployment
// ============================================
export const DEFAULT_SOP_SHEET_MAPPINGS: Record<string, string> = {
  'DEWA': 'Dewa',
  'GEDE BUDI': 'Gede Budi ',
  'MERTANA': 'Mertana',
  'SUPRI': 'Supri',
  'TRI': 'TRI',
  'TUNIK': 'Tunik',
  'PANDE': 'Pande',
  'TUDE': 'Tude',
};

// ============================================
// INDONESIAN DATE FORMATTING
// ============================================
const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatIndonesianDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = INDONESIAN_DAYS[date.getDay()];
  const dateNum = date.getDate();
  const month = INDONESIAN_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day}, ${dateNum} ${month} ${year}`;
}

export function formatIndonesianDateParts(dateStr: string): { day: string; date: string; month: string; year: string } {
  const date = new Date(dateStr);
  return {
    day: String(date.getDate()),
    date: String(date.getDate()),
    month: INDONESIAN_MONTHS[date.getMonth()],
    year: String(date.getFullYear()),
  };
}
