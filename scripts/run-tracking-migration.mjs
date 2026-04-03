#!/usr/bin/env node

/**
 * Migration script for customer order tracking feature
 * Run with: node scripts/run-tracking-migration.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vkpjocnrefjfpuovzinn.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo";

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: "public" },
  auth: { persistSession: false }
});

// SQL statements to run
const migrations = [
  // 1. Add columns to repairs
  `ALTER TABLE repairs ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE`,
  `ALTER TABLE repairs ADD COLUMN IF NOT EXISTS customer_email TEXT`,
  `ALTER TABLE repairs ADD COLUMN IF NOT EXISTS estimated_completion_date DATE`,
  
  // 2. Add columns to bespoke_jobs  
  `ALTER TABLE bespoke_jobs ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE`,
  `ALTER TABLE bespoke_jobs ADD COLUMN IF NOT EXISTS customer_email TEXT`,
  `ALTER TABLE bespoke_jobs ADD COLUMN IF NOT EXISTS estimated_completion_date DATE`,
  
  // 3. Create order_attachments table
  `CREATE TABLE IF NOT EXISTS order_attachments (
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
  )`,
  
  // 4. Create order_status_history table
  `CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL CHECK (order_type IN ('repair', 'bespoke')),
    order_id UUID NOT NULL,
    status TEXT NOT NULL,
    notes TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  
  // 5. Create indexes
  `CREATE INDEX IF NOT EXISTS idx_repairs_tracking_id ON repairs(tracking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_tracking_id ON bespoke_jobs(tracking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_attachments_order ON order_attachments(order_type, order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_type, order_id)`,
  
  // 6. Create tracking ID generator function
  `CREATE OR REPLACE FUNCTION generate_tracking_id(prefix TEXT)
   RETURNS TEXT AS $$
   BEGIN
     RETURN prefix || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
   END;
   $$ LANGUAGE plpgsql`,
   
  // 7. Trigger for repairs
  `CREATE OR REPLACE FUNCTION set_repair_tracking_id()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.tracking_id IS NULL THEN
       NEW.tracking_id := generate_tracking_id('RPR');
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
   
  `DROP TRIGGER IF EXISTS trigger_set_repair_tracking_id ON repairs`,
  `CREATE TRIGGER trigger_set_repair_tracking_id
     BEFORE INSERT ON repairs
     FOR EACH ROW
     EXECUTE FUNCTION set_repair_tracking_id()`,
     
  // 8. Trigger for bespoke_jobs
  `CREATE OR REPLACE FUNCTION set_bespoke_tracking_id()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.tracking_id IS NULL THEN
       NEW.tracking_id := generate_tracking_id('BSP');
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
   
  `DROP TRIGGER IF EXISTS trigger_set_bespoke_tracking_id ON bespoke_jobs`,
  `CREATE TRIGGER trigger_set_bespoke_tracking_id
     BEFORE INSERT ON bespoke_jobs
     FOR EACH ROW
     EXECUTE FUNCTION set_bespoke_tracking_id()`,
     
  // 9. Populate existing records with tracking IDs
  `UPDATE repairs SET tracking_id = generate_tracking_id('RPR') WHERE tracking_id IS NULL`,
  `UPDATE bespoke_jobs SET tracking_id = generate_tracking_id('BSP') WHERE tracking_id IS NULL`,
  
  // 10. Enable RLS
  `ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY`,
  
  // 11. RLS policies for order_attachments
  `DROP POLICY IF EXISTS "Allow public read for public attachments" ON order_attachments`,
  `CREATE POLICY "Allow public read for public attachments" ON order_attachments
     FOR SELECT USING (is_public = true)`,
     
  `DROP POLICY IF EXISTS "Tenants manage own attachments" ON order_attachments`,
  `CREATE POLICY "Tenants manage own attachments" ON order_attachments
     FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))`,
     
  // 12. RLS policies for order_status_history
  `DROP POLICY IF EXISTS "Allow public read for status history" ON order_status_history`,
  `CREATE POLICY "Allow public read for status history" ON order_status_history
     FOR SELECT USING (true)`,
     
  `DROP POLICY IF EXISTS "Tenants manage own history" ON order_status_history`,
  `CREATE POLICY "Tenants manage own history" ON order_status_history
     FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))`,
];

async function runMigration() {
  console.log("🚀 Starting tracking tables migration...\n");
  
  // We can't run raw SQL via REST API directly, but we can check if tables exist
  // and create them via the management API or SQL editor
  
  // For now, let's output the SQL and use psql or the dashboard
  console.log("⚠️  Direct SQL execution not available via REST API.");
  console.log("📋 Please run the following SQL in the Supabase SQL Editor:\n");
  console.log("=".repeat(60));
  console.log(migrations.join(";\n\n") + ";");
  console.log("=".repeat(60));
  
  // Check current state
  console.log("\n📊 Checking current table state...\n");
  
  const { data: repairs, error: repairsErr } = await supabase
    .from("repairs")
    .select("tracking_id")
    .limit(1);
    
  if (repairsErr && repairsErr.message.includes("tracking_id")) {
    console.log("❌ repairs.tracking_id column does NOT exist");
  } else {
    console.log("✅ repairs table accessible (tracking_id may exist)");
  }
  
  const { data: attachments, error: attachmentsErr } = await supabase
    .from("order_attachments")
    .select("id")
    .limit(1);
    
  if (attachmentsErr) {
    console.log("❌ order_attachments table does NOT exist");
  } else {
    console.log("✅ order_attachments table exists");
  }
  
  const { data: history, error: historyErr } = await supabase
    .from("order_status_history")
    .select("id")
    .limit(1);
    
  if (historyErr) {
    console.log("❌ order_status_history table does NOT exist");
  } else {
    console.log("✅ order_status_history table exists");
  }
}

runMigration().catch(console.error);
