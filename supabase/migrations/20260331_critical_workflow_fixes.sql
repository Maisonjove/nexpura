-- =====================================================
-- CRITICAL WORKFLOW FIXES - March 31, 2026
-- Fixes: Invoice payments, Stock management, Task status, Plan sync
-- =====================================================

-- 1. INVOICE PAYMENT SYNCHRONIZATION
DROP TRIGGER IF EXISTS sync_invoice_on_payment ON payments;
DROP FUNCTION IF EXISTS sync_invoice_payment_totals() CASCADE;

CREATE OR REPLACE FUNCTION sync_invoice_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
  v_new_status TEXT;
  v_invoice_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;
  
  IF v_invoice_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments WHERE invoice_id = v_invoice_id;
  
  SELECT total INTO v_invoice_total
  FROM invoices WHERE id = v_invoice_id;
  
  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
    v_total_paid := v_invoice_total;
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'unpaid';
  END IF;
  
  UPDATE invoices
  SET amount_paid = v_total_paid, status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE NULL END,
      updated_at = NOW()
  WHERE id = v_invoice_id;
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_invoice_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_payment_totals();

-- 2. STOCK MOVEMENT -> INVENTORY SYNC
DROP TRIGGER IF EXISTS sync_inventory_on_stock_movement_insert ON stock_movements;
DROP TRIGGER IF EXISTS sync_inventory_on_stock_movement_delete ON stock_movements;
DROP FUNCTION IF EXISTS sync_inventory_quantity() CASCADE;

CREATE OR REPLACE FUNCTION sync_inventory_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_inventory_id UUID;
  v_quantity_change INTEGER;
  v_current_quantity INTEGER;
  v_new_quantity INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_inventory_id := OLD.inventory_id;
    v_quantity_change := -OLD.quantity_change;
  ELSE
    v_inventory_id := NEW.inventory_id;
    v_quantity_change := NEW.quantity_change;
  END IF;
  
  SELECT quantity INTO v_current_quantity FROM inventory WHERE id = v_inventory_id;
  v_new_quantity := GREATEST(COALESCE(v_current_quantity, 0) + v_quantity_change, 0);
  
  UPDATE inventory SET quantity = v_new_quantity, updated_at = NOW()
  WHERE id = v_inventory_id;
  
  IF TG_OP = 'INSERT' THEN
    NEW.quantity_after := v_new_quantity;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN RETURN OLD;
  ELSE RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_inventory_on_stock_movement_insert
  BEFORE INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION sync_inventory_quantity();
CREATE TRIGGER sync_inventory_on_stock_movement_delete
  AFTER DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION sync_inventory_quantity();

-- 3. SALE ITEMS -> STOCK DECREMENT
DROP TRIGGER IF EXISTS decrement_stock_on_sale ON sale_items;
DROP FUNCTION IF EXISTS decrement_stock_on_sale_item() CASCADE;

CREATE OR REPLACE FUNCTION decrement_stock_on_sale_item()
RETURNS TRIGGER AS $$
DECLARE v_tenant_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.inventory_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM sales WHERE id = NEW.sale_id;
    INSERT INTO stock_movements (tenant_id, inventory_id, movement_type, quantity_change, reference_type, reference_id, notes)
    VALUES (v_tenant_id, NEW.inventory_id, 'sale', -NEW.quantity, 'sale_item', NEW.id, 'Stock sold via POS');
  ELSIF TG_OP = 'DELETE' AND OLD.inventory_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM sales WHERE id = OLD.sale_id;
    INSERT INTO stock_movements (tenant_id, inventory_id, movement_type, quantity_change, reference_type, reference_id, notes)
    VALUES (v_tenant_id, OLD.inventory_id, 'return', OLD.quantity, 'sale_item', OLD.id, 'Stock returned');
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER decrement_stock_on_sale
  AFTER INSERT OR DELETE ON sale_items FOR EACH ROW EXECUTE FUNCTION decrement_stock_on_sale_item();

-- 4. TASK STATUS CONSTRAINT
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('todo', 'in_progress', 'blocked', 'done', 'completed', 'cancelled'));

-- 5. PLAN SYNCHRONIZATION
DROP TRIGGER IF EXISTS sync_tenant_plan_on_subscription ON subscriptions;
DROP FUNCTION IF EXISTS sync_tenant_plan() CASCADE;

CREATE OR REPLACE FUNCTION sync_tenant_plan()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tenants SET plan = NEW.plan, updated_at = NOW() WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_tenant_plan_on_subscription
  AFTER INSERT OR UPDATE OF plan ON subscriptions FOR EACH ROW EXECUTE FUNCTION sync_tenant_plan();

-- Fix existing mismatched plans
UPDATE tenants t SET plan = s.plan
FROM subscriptions s WHERE t.id = s.tenant_id AND s.status = 'active' AND t.plan IS DISTINCT FROM s.plan;
