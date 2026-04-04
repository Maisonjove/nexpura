-- Enhanced RLS Policies for Critical Tables
-- Ensures tenant isolation at database level as defense-in-depth

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_tenant_isolation' AND tablename = 'customers') THEN
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY customers_tenant_isolation ON customers
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- INVENTORY TABLE
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'inventory_tenant_isolation' AND tablename = 'inventory') THEN
    ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
    CREATE POLICY inventory_tenant_isolation ON inventory
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- SALES TABLE
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sales_tenant_isolation' AND tablename = 'sales') THEN
    ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
    CREATE POLICY sales_tenant_isolation ON sales
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- INVOICES TABLE
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoices_tenant_isolation' AND tablename = 'invoices') THEN
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    CREATE POLICY invoices_tenant_isolation ON invoices
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- QUOTES TABLE
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quotes_tenant_isolation' AND tablename = 'quotes') THEN
    ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY quotes_tenant_isolation ON quotes
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- SUPPLIERS TABLE
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'suppliers_tenant_isolation' AND tablename = 'suppliers') THEN
    ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY suppliers_tenant_isolation ON suppliers
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- EXPENSES TABLE
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'expenses_tenant_isolation' AND tablename = 'expenses') THEN
    ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
    CREATE POLICY expenses_tenant_isolation ON expenses
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- TASKS TABLE
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tasks_tenant_isolation' AND tablename = 'tasks') THEN
    ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tasks_tenant_isolation ON tasks
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

