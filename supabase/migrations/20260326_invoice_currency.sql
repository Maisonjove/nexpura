-- Add currency support to invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'AUD',
ADD COLUMN IF NOT EXISTS exchange_rate numeric(10,6) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_currency text DEFAULT 'AUD',
ADD COLUMN IF NOT EXISTS base_total numeric(12,2);

-- Add currency exchange rates table for historical tracking
CREATE TABLE IF NOT EXISTS public.currency_exchange_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_currency text NOT NULL DEFAULT 'AUD',
  target_currency text NOT NULL,
  rate numeric(10,6) NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(base_currency, target_currency, fetched_at::date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON public.currency_exchange_rates(base_currency, target_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON public.currency_exchange_rates(fetched_at);

-- Supported currencies reference
CREATE TABLE IF NOT EXISTS public.supported_currencies (
  code text PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  decimal_places integer DEFAULT 2,
  is_active boolean DEFAULT true
);

-- Insert default supported currencies
INSERT INTO public.supported_currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('AUD', 'Australian Dollar', 'A$'),
  ('NZD', 'New Zealand Dollar', 'NZ$'),
  ('CAD', 'Canadian Dollar', 'C$'),
  ('CHF', 'Swiss Franc', 'CHF'),
  ('JPY', 'Japanese Yen', '¥'),
  ('SGD', 'Singapore Dollar', 'S$'),
  ('HKD', 'Hong Kong Dollar', 'HK$')
ON CONFLICT (code) DO NOTHING;

-- Comment for clarity
COMMENT ON COLUMN public.invoices.currency IS 'Invoice currency code (USD, EUR, GBP, AUD, etc.)';
COMMENT ON COLUMN public.invoices.exchange_rate IS 'Exchange rate from invoice currency to base currency at time of creation';
COMMENT ON COLUMN public.invoices.base_currency IS 'Tenant base currency for reporting';
COMMENT ON COLUMN public.invoices.base_total IS 'Total converted to base currency for reporting';
