-- Add valuation/insurance fields to passports
ALTER TABLE passports
  ADD COLUMN IF NOT EXISTS insured_value numeric(12, 2),
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS last_valuation_date date,
  ADD COLUMN IF NOT EXISTS last_valuation_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS last_valuation_by text,
  ADD COLUMN IF NOT EXISTS replacement_value numeric(12, 2);

COMMENT ON COLUMN passports.insured_value IS 'Current insured value in AUD';
COMMENT ON COLUMN passports.insurance_policy_number IS 'Insurance policy reference';
COMMENT ON COLUMN passports.insurance_provider IS 'Insurance provider name';
COMMENT ON COLUMN passports.last_valuation_date IS 'Date of most recent professional valuation';
COMMENT ON COLUMN passports.last_valuation_amount IS 'Amount from last professional valuation';
COMMENT ON COLUMN passports.last_valuation_by IS 'Valuer name/company';
COMMENT ON COLUMN passports.replacement_value IS 'Current replacement value estimate';
