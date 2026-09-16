-- ============================================
-- TOOL MANAGEMENT SYSTEM - SCHEMA UPDATE
-- Part 5: Report Generation & Template Management
-- ============================================

-- ============================================
-- REPORT TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL CHECK (template_type IN ('SOP_ALAT', 'LAPORAN_HARIAN_ALAT')),
  template_name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Only one active template per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_templates_active_type 
  ON report_templates(template_type) WHERE active = true;

-- ============================================
-- TECHNICIAN REPORT MAPPINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS technician_report_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('SOP_ALAT', 'LAPORAN_HARIAN_ALAT')),
  sheet_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(technician_id, template_type)
);

-- ============================================
-- REPORT GENERATION LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS report_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('SOP_ALAT', 'LAPORAN_HARIAN_ALAT')),
  transaction_id UUID REFERENCES transactions(id),
  report_date DATE,
  template_id UUID REFERENCES report_templates(id),
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  file_name TEXT,
  filters JSONB,
  notes TEXT
);

-- ============================================
-- ADD SOP TRACKING TO TRANSACTIONS TABLE
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'sop_generated_at') THEN
    ALTER TABLE transactions ADD COLUMN sop_generated_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'sop_generated_by') THEN
    ALTER TABLE transactions ADD COLUMN sop_generated_by UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'sop_template_version') THEN
    ALTER TABLE transactions ADD COLUMN sop_template_version INTEGER;
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_technician_report_mappings_technician ON technician_report_mappings(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_report_mappings_type ON technician_report_mappings(template_type);
CREATE INDEX IF NOT EXISTS idx_report_generation_logs_type ON report_generation_logs(report_type);
CREATE INDEX IF NOT EXISTS idx_report_generation_logs_date ON report_generation_logs(report_date);
CREATE INDEX IF NOT EXISTS idx_report_generation_logs_transaction ON report_generation_logs(transaction_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_report_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generation_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read templates
CREATE POLICY "Users can read report templates" ON report_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only SUPER_ADMIN can manage templates
CREATE POLICY "Super admin can manage templates" ON report_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

-- Authenticated users can read mappings
CREATE POLICY "Users can read technician mappings" ON technician_report_mappings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only SUPER_ADMIN can manage mappings
CREATE POLICY "Super admin can manage mappings" ON technician_report_mappings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

-- Authenticated users can read and create generation logs
CREATE POLICY "Users can read generation logs" ON report_generation_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create generation logs" ON report_generation_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- SEED DATA: Default technician mappings for SOP
-- Based on actual template sheet names
-- ============================================
-- These will be linked to technicians after they are created
-- The sheet names match exactly what's in the SOP template:
-- Dewa, Gede Budi, Mertana, Supri, TRI, Tunik, Pande, Tude
