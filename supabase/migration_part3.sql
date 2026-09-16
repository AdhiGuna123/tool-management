-- ============================================
-- TOOL MANAGEMENT SYSTEM - SCHEMA UPDATE
-- Part 3: Pengembalian Alat & Stock Finalization
-- ============================================

-- ============================================
-- RETURN EVENTS TABLE
-- Tracks each return processing event
-- ============================================
CREATE TABLE IF NOT EXISTS return_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- RETURN EVENT ITEMS TABLE
-- Tracks per-item return quantities for each event
-- ============================================
CREATE TABLE IF NOT EXISTS return_event_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_event_id UUID NOT NULL REFERENCES return_events(id) ON DELETE CASCADE,
  transaction_item_id UUID NOT NULL REFERENCES transaction_items(id) ON DELETE CASCADE,
  returned_qty INTEGER NOT NULL DEFAULT 0 CHECK (returned_qty >= 0),
  used_qty INTEGER NOT NULL DEFAULT 0 CHECK (used_qty >= 0),
  damaged_qty INTEGER NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
  lost_qty INTEGER NOT NULL DEFAULT 0 CHECK (lost_qty >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ADD COLUMNS TO TRANSACTIONS
-- ============================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS has_damage BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS has_loss BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS return_processed_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS return_processed_by UUID REFERENCES profiles(id);

-- ============================================
-- ADD COLUMNS TO TRANSACTION_ITEMS
-- ============================================
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS expected_return_date DATE;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT 'BELUM_KEMBALI' CHECK (
  return_status IN (
    'KEMBALI_BAIK', 'BELUM_KEMBALI', 'RUSAK', 'HILANG', 
    'HABIS_DIPAKAI', 'SEBAGIAN_KEMBALI'
  )
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_return_events_transaction ON return_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_return_events_processed_at ON return_events(processed_at);
CREATE INDEX IF NOT EXISTS idx_return_event_items_event ON return_event_items(return_event_id);
CREATE INDEX IF NOT EXISTS idx_return_event_items_transaction_item ON return_event_items(transaction_item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_return_status ON transactions(status, return_processed_at);
CREATE INDEX IF NOT EXISTS idx_transaction_items_return_status ON transaction_items(return_status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_transaction ON stock_movements(transaction_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE return_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_event_items ENABLE ROW LEVEL SECURITY;

-- Return Events
CREATE POLICY "Authenticated users can view return events" ON return_events FOR SELECT USING (true);
CREATE POLICY "Admins can insert return events" ON return_events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Return Event Items
CREATE POLICY "Authenticated users can view return event items" ON return_event_items FOR SELECT USING (true);
CREATE POLICY "Admins can insert return event items" ON return_event_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
);
