-- Migration: Customer Order Tracking Feature
-- Run this in the Supabase SQL Editor at: https://supabase.com/dashboard/project/vkpjocnrefjfpuovzinn/sql

-- ============================================
-- 1. Add tracking columns to repairs table
-- ============================================
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS estimated_completion_date DATE;

-- ============================================
-- 2. Add tracking columns to bespoke_jobs table
-- ============================================
ALTER TABLE bespoke_jobs ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE;
ALTER TABLE bespoke_jobs ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE bespoke_jobs ADD COLUMN IF NOT EXISTS estimated_completion_date DATE;

-- ============================================
-- 3. Create order_attachments table
-- ============================================
CREATE TABLE IF NOT EXISTS order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('repair', 'bespoke')),
  order_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Create order_status_history table
-- ============================================
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('repair', 'bespoke')),
  order_id UUID NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Create indexes for fast lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_repairs_tracking_id ON repairs(tracking_id);
CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_tracking_id ON bespoke_jobs(tracking_id);
CREATE INDEX IF NOT EXISTS idx_order_attachments_order ON order_attachments(order_type, order_id);
CREATE INDEX IF NOT EXISTS idx_order_attachments_tenant ON order_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_type, order_id);
CREATE INDEX IF NOT EXISTS idx_status_history_tenant ON order_status_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON order_status_history(changed_at DESC);

-- ============================================
-- 6. Create tracking ID generator function
-- ============================================
CREATE OR REPLACE FUNCTION generate_tracking_id(prefix TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Create trigger for repairs tracking ID
-- ============================================
CREATE OR REPLACE FUNCTION set_repair_tracking_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_id IS NULL THEN
    NEW.tracking_id := generate_tracking_id('RPR');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_repair_tracking_id ON repairs;
CREATE TRIGGER trigger_set_repair_tracking_id
  BEFORE INSERT ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION set_repair_tracking_id();

-- ============================================
-- 8. Create trigger for bespoke_jobs tracking ID
-- ============================================
CREATE OR REPLACE FUNCTION set_bespoke_tracking_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_id IS NULL THEN
    NEW.tracking_id := generate_tracking_id('BSP');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_bespoke_tracking_id ON bespoke_jobs;
CREATE TRIGGER trigger_set_bespoke_tracking_id
  BEFORE INSERT ON bespoke_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_bespoke_tracking_id();

-- ============================================
-- 9. Generate tracking IDs for existing records
-- ============================================
UPDATE repairs SET tracking_id = generate_tracking_id('RPR') WHERE tracking_id IS NULL;
UPDATE bespoke_jobs SET tracking_id = generate_tracking_id('BSP') WHERE tracking_id IS NULL;

-- ============================================
-- 10. Enable RLS on new tables
-- ============================================
ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. RLS Policies for order_attachments
-- ============================================
-- Allow public read for public attachments (for tracking page)
DROP POLICY IF EXISTS "Allow public read for public attachments" ON order_attachments;
CREATE POLICY "Allow public read for public attachments" ON order_attachments
  FOR SELECT USING (is_public = true);

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access attachments" ON order_attachments;
CREATE POLICY "Service role full access attachments" ON order_attachments
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 12. RLS Policies for order_status_history
-- ============================================
-- Allow public read (for tracking page)
DROP POLICY IF EXISTS "Allow public read for status history" ON order_status_history;
CREATE POLICY "Allow public read for status history" ON order_status_history
  FOR SELECT USING (true);

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access history" ON order_status_history;
CREATE POLICY "Service role full access history" ON order_status_history
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 13. Create storage bucket for order attachments
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-attachments', 'order-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for public read
DROP POLICY IF EXISTS "Public read for order attachments" ON storage.objects;
CREATE POLICY "Public read for order attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'order-attachments');

-- Storage policy for authenticated upload
DROP POLICY IF EXISTS "Authenticated upload for order attachments" ON storage.objects;
CREATE POLICY "Authenticated upload for order attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'order-attachments' AND auth.role() = 'authenticated');

-- Done!
SELECT 'Migration completed successfully!' as status;
