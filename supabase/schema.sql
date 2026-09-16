-- ============================================
-- TOOL MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Part 1: Foundation
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN', 'SUPER_ADMIN')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TECHNICIANS TABLE
-- ============================================
CREATE TABLE technicians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_code TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF', 'SELESAI', 'ARSIP')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- ITEMS TABLE (MASTER BARANG / MASTER STOK)
-- ============================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_code TEXT UNIQUE,
  item_name TEXT NOT NULL,
  category TEXT,
  item_type TEXT NOT NULL DEFAULT 'TOOL' CHECK (item_type IN ('TOOL', 'CONSUMABLE')),
  unit TEXT,
  current_stock INTEGER CHECK (current_stock >= 0),
  stock_known BOOLEAN NOT NULL DEFAULT true,
  storage_location TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- TECHNICIAN DEFAULT ITEMS TABLE
-- ============================================
CREATE TABLE technician_default_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  default_qty INTEGER NOT NULL DEFAULT 1 CHECK (default_qty > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(technician_id, item_id)
);

-- ============================================
-- TRANSACTIONS TABLE (PREPARED - NOT IMPLEMENTED)
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_number TEXT NOT NULL UNIQUE,
  technician_id UUID NOT NULL REFERENCES technicians(id),
  project_id UUID REFERENCES projects(id),
  manual_project_name TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  borrowed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP', 
    'SELESAI', 'BERMASALAH', 'DIBATALKAN'
  )),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TRANSACTION ITEMS TABLE (PREPARED - NOT IMPLEMENTED)
-- ============================================
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT,
  item_type_snapshot TEXT NOT NULL CHECK (item_type_snapshot IN ('TOOL', 'CONSUMABLE')),
  is_manual_item BOOLEAN NOT NULL DEFAULT false,
  borrow_qty INTEGER NOT NULL DEFAULT 0 CHECK (borrow_qty >= 0),
  returned_qty INTEGER DEFAULT 0 CHECK (returned_qty >= 0),
  used_qty INTEGER DEFAULT 0 CHECK (used_qty >= 0),
  damaged_qty INTEGER DEFAULT 0 CHECK (damaged_qty >= 0),
  lost_qty INTEGER DEFAULT 0 CHECK (lost_qty >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STOCK MOVEMENTS TABLE (PREPARED - NOT IMPLEMENTED)
-- ============================================
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id),
  transaction_id UUID REFERENCES transactions(id),
  technician_id UUID REFERENCES technicians(id),
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  stock_before INTEGER,
  stock_after INTEGER,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ATTACHMENTS TABLE (PREPARED - NOT IMPLEMENTED)
-- ============================================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id),
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('TTD', 'KERUSAKAN', 'LAINNYA')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_technicians_code ON technicians(technician_code);
CREATE INDEX idx_technicians_active ON technicians(active);
CREATE INDEX idx_projects_code ON projects(project_code);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_items_code ON items(item_code);
CREATE INDEX idx_items_type ON items(item_type);
CREATE INDEX idx_items_active ON items(active);
CREATE INDEX idx_items_stock_known ON items(stock_known);
CREATE INDEX idx_technician_default_items_technician ON technician_default_items(technician_id);
CREATE INDEX idx_technician_default_items_item ON technician_default_items(item_id);
CREATE INDEX idx_transactions_technician ON transactions(technician_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_default_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, only admins can modify
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

-- Technicians: Authenticated users can read, only admins can modify
CREATE POLICY "Authenticated users can view technicians" ON technicians FOR SELECT USING (true);
CREATE POLICY "Admins can insert technicians" ON technicians FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);
CREATE POLICY "Admins can update technicians" ON technicians FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Projects: Authenticated users can read, only admins can modify
CREATE POLICY "Authenticated users can view projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Admins can insert projects" ON projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);
CREATE POLICY "Admins can update projects" ON projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Items: Authenticated users can read, only admins can modify
CREATE POLICY "Authenticated users can view items" ON items FOR SELECT USING (true);
CREATE POLICY "Admins can insert items" ON items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);
CREATE POLICY "Admins can update items" ON items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Technician Default Items
CREATE POLICY "Authenticated users can view default items" ON technician_default_items FOR SELECT USING (true);
CREATE POLICY "Admins can insert default items" ON technician_default_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);
CREATE POLICY "Admins can update default items" ON technician_default_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);
CREATE POLICY "Admins can delete default items" ON technician_default_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Transactions (prepared for future)
CREATE POLICY "Authenticated users can view transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Admins can insert transactions" ON transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);
CREATE POLICY "Admins can update transactions" ON transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Transaction Items (prepared for future)
CREATE POLICY "Authenticated users can view transaction items" ON transaction_items FOR SELECT USING (true);
CREATE POLICY "Admins can insert transaction items" ON transaction_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Stock Movements (prepared for future)
CREATE POLICY "Authenticated users can view stock movements" ON stock_movements FOR SELECT USING (true);
CREATE POLICY "Admins can insert stock movements" ON stock_movements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Attachments (prepared for future)
CREATE POLICY "Authenticated users can view attachments" ON attachments FOR SELECT USING (true);
CREATE POLICY "Admins can insert attachments" ON attachments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Audit Logs: Only SUPER_ADMIN can view
CREATE POLICY "Super admins can view audit logs" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);
CREATE POLICY "System can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technicians_updated_at BEFORE UPDATE ON technicians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technician_default_items_updated_at BEFORE UPDATE ON technician_default_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

-- View for technician with item count
CREATE OR REPLACE VIEW technician_stats AS
SELECT 
  t.*,
  COUNT(tdi.id) as item_count
FROM technicians t
LEFT JOIN technician_default_items tdi ON t.id = tdi.technician_id
GROUP BY t.id;

-- View for items with technician usage count
CREATE OR REPLACE VIEW item_usage_stats AS
SELECT 
  i.*,
  COUNT(tdi.id) as used_by_technicians
FROM items i
LEFT JOIN technician_default_items tdi ON i.id = tdi.item_id
GROUP BY i.id;
