-- ============================================
-- TOOL MANAGEMENT SYSTEM - SCHEMA UPDATE
-- Part 4: Dashboard, History & Audit Monitoring
-- ============================================

-- ============================================
-- ADDITIONAL INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_items_item_id ON transaction_items(item_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_item_name ON transaction_items(item_name_snapshot);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_return_events_processed_at ON return_events(processed_at);
CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON attachments(transaction_id);

-- ============================================
-- DASHBOARD VIEW: Transaction Stats
-- ============================================
CREATE OR REPLACE VIEW dashboard_transaction_stats AS
SELECT
  (SELECT COUNT(DISTINCT t.technician_id) 
   FROM transactions t 
   WHERE t.status IN ('SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP')) as technicians_borrowing,
  (SELECT COUNT(*) 
   FROM transactions t 
   WHERE t.status = 'SELESAI' 
   AND t.returned_at::date = CURRENT_DATE) as completed_today,
  (SELECT COUNT(*) 
   FROM transactions t 
   WHERE t.status = 'PENGEMBALIAN_BELUM_LENGKAP') as incomplete_returns,
  (SELECT COUNT(*) 
   FROM transactions t 
   WHERE t.has_damage = true 
   AND t.status IN ('SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP')) as damaged_items,
  (SELECT COUNT(*) 
   FROM transaction_items ti 
   WHERE ti.is_manual_item = true 
   AND ti.item_id IS NULL) as unregistered_items,
  (SELECT COUNT(*) 
   FROM items i 
   WHERE i.stock_known = false 
   AND i.active = true) as unknown_stock_items;

-- ============================================
-- VIEW: Outstanding Items
-- ============================================
CREATE OR REPLACE VIEW outstanding_items_view AS
SELECT
  ti.id,
  ti.transaction_id,
  ti.item_name_snapshot,
  ti.unit_snapshot,
  ti.item_type_snapshot,
  ti.borrow_qty,
  ti.returned_qty,
  ti.used_qty,
  ti.damaged_qty,
  ti.lost_qty,
  (ti.borrow_qty - COALESCE(ti.returned_qty, 0) - COALESCE(ti.used_qty, 0) - COALESCE(ti.damaged_qty, 0) - COALESCE(ti.lost_qty, 0)) as outstanding_qty,
  ti.return_status,
  t.transaction_number,
  t.transaction_date,
  t.status as transaction_status,
  tech.name as technician_name,
  tech.technician_code,
  p.project_name
FROM transaction_items ti
JOIN transactions t ON ti.transaction_id = t.id
JOIN technicians tech ON t.technician_id = tech.id
LEFT JOIN projects p ON t.project_id = p.id
WHERE t.status IN ('SEDANG_DIPINJAM', 'PENGEMBALIAN_BELUM_LENGKAP')
AND (ti.borrow_qty - COALESCE(ti.returned_qty, 0) - COALESCE(ti.used_qty, 0) - COALESCE(ti.damaged_qty, 0) - COALESCE(ti.lost_qty, 0)) > 0;

-- ============================================
-- VIEW: Manual Items Usage
-- ============================================
CREATE OR REPLACE VIEW manual_items_usage AS
SELECT
  ti.item_name_snapshot,
  COUNT(*) as usage_count,
  MAX(t.transaction_date) as last_used_date,
  ARRAY_AGG(DISTINCT tech.name) as technicians,
  COUNT(DISTINCT t.id) as transaction_count
FROM transaction_items ti
JOIN transactions t ON ti.transaction_id = t.id
JOIN technicians tech ON t.technician_id = tech.id
WHERE ti.is_manual_item = true
AND ti.item_id IS NULL
GROUP BY ti.item_name_snapshot;
