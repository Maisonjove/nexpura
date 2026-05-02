-- Allow 'cancelled' status on sales so cancelLayby can flip a layby
-- to a terminal cancelled state. Existing values remain valid.

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('quote', 'confirmed', 'paid', 'completed', 'refunded', 'layby', 'cancelled'));
