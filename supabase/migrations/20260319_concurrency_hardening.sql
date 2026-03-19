-- ============================================================================
-- CONCURRENCY HARDENING MIGRATION
-- Adds database-level constraints to prevent data corruption
-- ============================================================================

-- 1. Inventory quantity cannot go negative
-- This is the last line of defense against overselling
ALTER TABLE inventory 
ADD CONSTRAINT inventory_quantity_non_negative 
CHECK (quantity >= 0);

-- 2. Customer store credit cannot go negative
ALTER TABLE customers 
ADD CONSTRAINT customers_store_credit_non_negative 
CHECK (store_credit >= 0);

-- 3. Voucher balance cannot go negative
ALTER TABLE gift_vouchers 
ADD CONSTRAINT gift_vouchers_balance_non_negative 
CHECK (balance >= 0);

-- 4. Invoice amount_paid cannot exceed total
CREATE OR REPLACE FUNCTION check_invoice_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount_paid > NEW.total + 0.01 THEN
    RAISE EXCEPTION 'Amount paid (%) cannot exceed invoice total (%)', NEW.amount_paid, NEW.total;
  END IF;
  IF NEW.amount_paid < 0 THEN
    RAISE EXCEPTION 'Amount paid cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_invoice_amount_paid ON invoices;
CREATE TRIGGER enforce_invoice_amount_paid
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_invoice_amount_paid();

-- 5. Sale amount_paid cannot exceed total (for laybys)
CREATE OR REPLACE FUNCTION check_sale_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount_paid > NEW.total + 0.01 THEN
    RAISE EXCEPTION 'Amount paid (%) cannot exceed sale total (%)', NEW.amount_paid, NEW.total;
  END IF;
  IF NEW.amount_paid < 0 THEN
    RAISE EXCEPTION 'Amount paid cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_sale_amount_paid ON sales;
CREATE TRIGGER enforce_sale_amount_paid
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION check_sale_amount_paid();

-- 6. Payment amounts must be positive
ALTER TABLE payments 
ADD CONSTRAINT payments_amount_positive 
CHECK (amount > 0);

-- 7. Layby payment amounts must be positive
ALTER TABLE layby_payments 
ADD CONSTRAINT layby_payments_amount_positive 
CHECK (amount > 0);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON CONSTRAINT inventory_quantity_non_negative ON inventory IS 
  'Hard safety: inventory cannot go negative, prevents silent overselling';

COMMENT ON CONSTRAINT customers_store_credit_non_negative ON customers IS 
  'Hard safety: store credit cannot go negative';

COMMENT ON CONSTRAINT gift_vouchers_balance_non_negative ON gift_vouchers IS 
  'Hard safety: voucher balance cannot go negative';

COMMENT ON CONSTRAINT payments_amount_positive ON payments IS 
  'Payments must be positive amounts';

COMMENT ON CONSTRAINT layby_payments_amount_positive ON layby_payments IS 
  'Layby payments must be positive amounts';
