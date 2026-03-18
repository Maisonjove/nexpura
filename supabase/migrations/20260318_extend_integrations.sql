-- ============================================================
-- EXTEND INTEGRATIONS TABLE TO SUPPORT NEW TYPES
-- Adds: google_calendar, twilio, square, woocommerce
-- ============================================================

-- Drop and recreate the type check constraint
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_type_check;

ALTER TABLE public.integrations 
  ADD CONSTRAINT integrations_type_check 
  CHECK (type IN (
    'xero', 
    'whatsapp', 
    'shopify', 
    'insurance',
    'google_calendar',
    'twilio',
    'square',
    'woocommerce'
  ));

-- Add appointment calendar sync column
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text;

-- Add job due date calendar sync column  
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text;
