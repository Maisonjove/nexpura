#!/usr/bin/env node

/**
 * Creates the customer order tracking tables:
 * - Adds tracking_id, customer_email, estimated_completion_date to repairs and bespoke_jobs
 * - Creates order_attachments table
 * - Creates order_status_history table
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("🚀 Starting tracking tables migration...\n");

  // 1. Add columns to repairs table
  console.log("1️⃣ Adding tracking columns to repairs table...");
  const { error: repairsAlterError } = await supabase.rpc("exec_sql", {
    sql: `
      ALTER TABLE repairs 
      ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS customer_email TEXT,
      ADD COLUMN IF NOT EXISTS estimated_completion_date DATE;
      
      -- Generate tracking IDs for existing repairs
      UPDATE repairs 
      SET tracking_id = 'RPR-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8))
      WHERE tracking_id IS NULL;
      
      -- Make tracking_id NOT NULL after populating
      ALTER TABLE repairs ALTER COLUMN tracking_id SET NOT NULL;
      
      -- Create index for fast lookups
      CREATE INDEX IF NOT EXISTS idx_repairs_tracking_id ON repairs(tracking_id);
    `,
  });

  if (repairsAlterError) {
    // Try alternative approach - run individual statements
    console.log("   Trying alternative approach for repairs...");
    
    // Add tracking_id
    await supabase.from("repairs").select("tracking_id").limit(1).catch(async () => {
      const { error } = await supabase.rpc("exec_sql", {
        sql: `ALTER TABLE repairs ADD COLUMN tracking_id TEXT;`
      });
      if (error && !error.message.includes("already exists")) throw error;
    });

    // Add customer_email
    await supabase.from("repairs").select("customer_email").limit(1).catch(async () => {
      const { error } = await supabase.rpc("exec_sql", {
        sql: `ALTER TABLE repairs ADD COLUMN customer_email TEXT;`
      });
      if (error && !error.message.includes("already exists")) throw error;
    });

    // Add estimated_completion_date
    await supabase.from("repairs").select("estimated_completion_date").limit(1).catch(async () => {
      const { error } = await supabase.rpc("exec_sql", {
        sql: `ALTER TABLE repairs ADD COLUMN estimated_completion_date DATE;`
      });
      if (error && !error.message.includes("already exists")) throw error;
    });
  }
  console.log("   ✅ Repairs table updated\n");

  // 2. Add columns to bespoke_jobs table
  console.log("2️⃣ Adding tracking columns to bespoke_jobs table...");
  const { error: bespokeAlterError } = await supabase.rpc("exec_sql", {
    sql: `
      ALTER TABLE bespoke_jobs 
      ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS customer_email TEXT,
      ADD COLUMN IF NOT EXISTS estimated_completion_date DATE;
      
      -- Generate tracking IDs for existing bespoke jobs
      UPDATE bespoke_jobs 
      SET tracking_id = 'BSP-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8))
      WHERE tracking_id IS NULL;
      
      -- Make tracking_id NOT NULL after populating
      ALTER TABLE bespoke_jobs ALTER COLUMN tracking_id SET NOT NULL;
      
      -- Create index for fast lookups
      CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_tracking_id ON bespoke_jobs(tracking_id);
    `,
  });

  if (bespokeAlterError) {
    console.log("   Trying alternative approach for bespoke_jobs...");
    
    await supabase.from("bespoke_jobs").select("tracking_id").limit(1).catch(async () => {
      const { error } = await supabase.rpc("exec_sql", {
        sql: `ALTER TABLE bespoke_jobs ADD COLUMN tracking_id TEXT;`
      });
      if (error && !error.message.includes("already exists")) throw error;
    });

    await supabase.from("bespoke_jobs").select("customer_email").limit(1).catch(async () => {
      const { error } = await supabase.rpc("exec_sql", {
        sql: `ALTER TABLE bespoke_jobs ADD COLUMN customer_email TEXT;`
      });
      if (error && !error.message.includes("already exists")) throw error;
    });

    await supabase.from("bespoke_jobs").select("estimated_completion_date").limit(1).catch(async () => {
      const { error } = await supabase.rpc("exec_sql", {
        sql: `ALTER TABLE bespoke_jobs ADD COLUMN estimated_completion_date DATE;`
      });
      if (error && !error.message.includes("already exists")) throw error;
    });
  }
  console.log("   ✅ Bespoke jobs table updated\n");

  // 3. Create order_attachments table
  console.log("3️⃣ Creating order_attachments table...");
  const { error: attachmentsError } = await supabase.rpc("exec_sql", {
    sql: `
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
        created_at TIMESTAMPTZ DEFAULT NOW(),
        
        CONSTRAINT fk_order_attachment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_order_attachments_tenant ON order_attachments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_order_attachments_order ON order_attachments(order_type, order_id);
      
      -- Enable RLS
      ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY;
      
      -- Policy for tenants to see their own attachments
      DROP POLICY IF EXISTS "Tenants can view own attachments" ON order_attachments;
      CREATE POLICY "Tenants can view own attachments" ON order_attachments
        FOR SELECT USING (
          tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        );
      
      -- Policy for tenants to insert attachments
      DROP POLICY IF EXISTS "Tenants can insert own attachments" ON order_attachments;
      CREATE POLICY "Tenants can insert own attachments" ON order_attachments
        FOR INSERT WITH CHECK (
          tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        );
      
      -- Policy for tenants to delete own attachments
      DROP POLICY IF EXISTS "Tenants can delete own attachments" ON order_attachments;
      CREATE POLICY "Tenants can delete own attachments" ON order_attachments
        FOR DELETE USING (
          tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        );
      
      -- Policy for public attachments (for tracking page)
      DROP POLICY IF EXISTS "Public can view public attachments" ON order_attachments;
      CREATE POLICY "Public can view public attachments" ON order_attachments
        FOR SELECT USING (is_public = true);
    `,
  });

  if (attachmentsError) {
    console.log("   ⚠️ Error creating order_attachments (may already exist):", attachmentsError.message);
  } else {
    console.log("   ✅ Order attachments table created\n");
  }

  // 4. Create order_status_history table
  console.log("4️⃣ Creating order_status_history table...");
  const { error: historyError } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS order_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        order_type TEXT NOT NULL CHECK (order_type IN ('repair', 'bespoke')),
        order_id UUID NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        changed_by UUID REFERENCES users(id),
        changed_at TIMESTAMPTZ DEFAULT NOW(),
        
        CONSTRAINT fk_status_history_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_status_history_tenant ON order_status_history(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_type, order_id);
      CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON order_status_history(changed_at DESC);
      
      -- Enable RLS
      ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
      
      -- Policy for tenants to see their own history
      DROP POLICY IF EXISTS "Tenants can view own status history" ON order_status_history;
      CREATE POLICY "Tenants can view own status history" ON order_status_history
        FOR SELECT USING (
          tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        );
      
      -- Policy for tenants to insert history
      DROP POLICY IF EXISTS "Tenants can insert status history" ON order_status_history;
      CREATE POLICY "Tenants can insert status history" ON order_status_history
        FOR INSERT WITH CHECK (
          tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        );
      
      -- Policy for public viewing (for tracking page)
      DROP POLICY IF EXISTS "Public can view status history" ON order_status_history;
      CREATE POLICY "Public can view status history" ON order_status_history
        FOR SELECT USING (true);
    `,
  });

  if (historyError) {
    console.log("   ⚠️ Error creating order_status_history (may already exist):", historyError.message);
  } else {
    console.log("   ✅ Order status history table created\n");
  }

  // 5. Create function to generate tracking IDs
  console.log("5️⃣ Creating tracking ID generator function...");
  const { error: funcError } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE OR REPLACE FUNCTION generate_tracking_id(prefix TEXT)
      RETURNS TEXT AS $$
      BEGIN
        RETURN prefix || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
      END;
      $$ LANGUAGE plpgsql;
    `,
  });

  if (funcError) {
    console.log("   ⚠️ Error creating function:", funcError.message);
  } else {
    console.log("   ✅ Tracking ID generator function created\n");
  }

  // 6. Create trigger to auto-generate tracking IDs on insert
  console.log("6️⃣ Creating triggers for auto-generating tracking IDs...");
  const { error: triggerError } = await supabase.rpc("exec_sql", {
    sql: `
      -- Trigger for repairs
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
      
      -- Trigger for bespoke_jobs
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
    `,
  });

  if (triggerError) {
    console.log("   ⚠️ Error creating triggers:", triggerError.message);
  } else {
    console.log("   ✅ Triggers created\n");
  }

  console.log("✅ Migration completed!\n");
}

runMigration().catch(console.error);
