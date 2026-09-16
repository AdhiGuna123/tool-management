-- ============================================
-- SEED DATA FOR TESTING
-- Run this after creating the schema
-- ============================================

-- NOTE: You need to first create a user in Supabase Auth
-- Then use that user's UUID here for the profile

-- Example profile (replace USER_UUID with actual auth user UUID)
-- INSERT INTO profiles (id, full_name, email, role) VALUES
-- ('USER_UUID', 'Administrator', 'admin@example.com', 'SUPER_ADMIN');

-- ============================================
-- TECHNICIANS
-- ============================================
INSERT INTO technicians (technician_code, name, active, notes, created_by) VALUES
('TEC-001', 'DEWA', true, 'Teknisi Senior', NULL),
('TEC-002', 'MERTANA', true, 'Teknisi Lapangan', NULL),
('TEC-003', 'SUPRI', true, 'Teknisi Junior', NULL),
('TEC-004', 'BUDI', true, 'Teknisi AC', NULL),
('TEC-005', 'ANDI', true, 'Teknisi Listrik', NULL);

-- ============================================
-- PROJECTS
-- ============================================
INSERT INTO projects (project_code, project_name, location, status, notes, created_by) VALUES
('PRJ-001', 'Project PEB', 'Jakarta Selatan', 'AKTIF', 'Proyek gedung perkantoran', NULL),
('PRJ-002', 'Project Office Tower', 'Jakarta Pusat', 'AKTIF', 'Maintenance rutin', NULL),
('PRJ-003', 'Project Mall ABC', 'Tangerang', 'SELESAI', 'Renovasi area tenant', NULL),
('PRJ-004', 'Project Gudang', 'Bekasi', 'ARSIP', 'Perbaikan sistem kelistrikan', NULL);

-- ============================================
-- ITEMS (MASTER BARANG)
-- ============================================
INSERT INTO items (item_code, item_name, category, item_type, unit, current_stock, stock_known, storage_location, notes, created_by) VALUES
-- Tools
('ALT-001', 'Tang Kombinasi', 'Hand Tool', 'TOOL', 'Pcs', 15, true, 'Rak A-01', 'Ukuran 8 inch', NULL),
('ALT-002', 'Tang Potong', 'Hand Tool', 'TOOL', 'Pcs', 12, true, 'Rak A-01', 'Untuk potong kabel', NULL),
('ALT-003', 'Obeng +', 'Hand Tool', 'TOOL', 'Pcs', 20, true, 'Rak A-02', 'Ukuran medium', NULL),
('ALT-004', 'Obeng -', 'Hand Tool', 'TOOL', 'Pcs', 20, true, 'Rak A-02', 'Ukuran medium', NULL),
('ALT-005', 'Palu', 'Hand Tool', 'TOOL', 'Pcs', 8, true, 'Rak A-03', 'Palu besi', NULL),
('ALT-006', 'Bor Tangan', 'Power Tool', 'TOOL', 'Unit', 5, true, 'Rak B-01', 'Baterai 12V', NULL),
('ALT-007', 'Multimeter', 'Measurement', 'TOOL', 'Unit', 4, true, 'Rak C-01', 'Digital', NULL),
('ALT-008', 'Gerinda Tangan', 'Power Tool', 'TOOL', 'Unit', 3, true, 'Rak B-02', '4 inch', NULL),
('ALT-009', 'Kunci Inggris', 'Hand Tool', 'TOOL', 'Pcs', 6, true, 'Rak A-03', 'Adjustable', NULL),
('ALT-010', 'Tang Cucut', 'Hand Tool', 'TOOL', 'Pcs', 7, true, 'Rak A-01', 'Untuk solder', NULL),

-- Consumables
('BKM-001', 'Cleaner AC', 'Chemical', 'CONSUMABLE', 'Liter', 25, true, 'Rak D-01', 'Cairan pembersih AC', NULL),
('BKM-002', 'Cable Tie', 'Fastener', 'CONSUMABLE', 'Pack', 50, true, 'Rak D-02', 'Ukuran 200mm', NULL),
('BKM-003', 'Isolasi', 'Electrical', 'CONSUMABLE', 'Roll', 30, true, 'Rak D-03', 'Hitam', NULL),
('BKM-004', 'Seal Tape', 'Plumbing', 'CONSUMABLE', 'Roll', 40, true, 'Rak D-04', 'Putih', NULL),
('BKM-005', 'Lem Besi', 'Adhesive', 'CONSUMABLE', 'Tube', 15, true, 'Rak D-05', 'Epoxy 2 komponen', NULL),

-- Items with unknown stock
('BRG-001', 'Siku Besi', 'Material', 'CONSUMABLE', 'Pcs', NULL, false, 'Rak E-01', 'Stok belum diperiksa', NULL),
('BRG-002', 'Pipa PVC 1/2"', 'Plumbing', 'CONSUMABLE', 'Meter', NULL, false, 'Rak E-02', 'Belum dihitung', NULL),
('BRG-003', 'Kabel NYM 2x2.5', 'Electrical', 'CONSUMABLE', 'Meter', NULL, false, 'Rak E-03', 'Perlu audit stok', NULL);

-- ============================================
-- TECHNICIAN DEFAULT ITEMS
-- ============================================
-- DEWA's tools
INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 1
FROM technicians t, items i
WHERE t.technician_code = 'TEC-001' AND i.item_code = 'ALT-001';

INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 1
FROM technicians t, items i
WHERE t.technician_code = 'TEC-001' AND i.item_code = 'ALT-002';

INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 1
FROM technicians t, items i
WHERE t.technician_code = 'TEC-001' AND i.item_code = 'ALT-003';

INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 1
FROM technicians t, items i
WHERE t.technician_code = 'TEC-001' AND i.item_code = 'ALT-004';

INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 1
FROM technicians t, items i
WHERE t.technician_code = 'TEC-001' AND i.item_code = 'ALT-005';

-- MERTANA's tools
INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 1
FROM technicians t, items i
WHERE t.technician_code = 'TEC-002' AND i.item_code = 'ALT-001';

INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 1
FROM technicians t, items i
WHERE t.technician_code = 'TEC-002' AND i.item_code = 'ALT-006';

INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 1
FROM technicians t, items i
WHERE t.technician_code = 'TEC-002' AND i.item_code = 'ALT-007';

-- SUPRI's tools
INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 2
FROM technicians t, items i
WHERE t.technician_code = 'TEC-003' AND i.item_code = 'BKM-001';

INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 3
FROM technicians t, items i
WHERE t.technician_code = 'TEC-003' AND i.item_code = 'BKM-002';

INSERT INTO technician_default_items (technician_id, item_id, default_qty) 
SELECT t.id, i.id, 2
FROM technicians t, items i
WHERE t.technician_code = 'TEC-003' AND i.item_code = 'BKM-003';
