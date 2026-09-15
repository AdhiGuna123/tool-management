-- ============================================
-- TOOL MANAGEMENT SYSTEM - SCHEMA UPDATE
-- Part 2: Pengembilan Alat
-- ============================================

-- Add location field to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location TEXT;

-- Add is_default_item field to transaction_items
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS is_default_item BOOLEAN NOT NULL DEFAULT false;

-- Enable pg_trgm for trigram search (must be before GIN trigram index)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status_date ON transactions(status, transaction_date);
CREATE INDEX IF NOT EXISTS idx_items_name_search ON items USING gin(item_name gin_trgm_ops);
