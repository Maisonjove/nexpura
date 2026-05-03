-- shop_enquiries status constraint widening — Group 14 audit.
--
-- Why: /enquiries lets staff transition an enquiry through:
--   - new (default)
--   - contacted (via "Mark Contacted" button)
--   - booked (via the Update Status modal)
--   - completed (via "Complete" button + Update Status modal)
--   - converted (set by convertEnquiry → repair / quote / sale, idempotency
--     marker so the destination link survives re-clicks)
--
-- But the DB constraint only allowed ('new', 'read', 'replied', 'archived').
-- Net: every status transition the UI offers — Mark Contacted, Update Status,
-- Convert to repair — was silently failing at the DB with a 23514 check
-- violation, since the action code didn't surface the update error. The
-- enquiry stayed at 'new' regardless of which button was clicked.
--
-- Fix: drop the existing constraint and re-add with the union of:
--   - the legacy values ('new', 'read', 'replied', 'archived') so any
--     existing rows / external integrations (the public website form)
--     still write valid values
--   - the UI workflow values ('contacted', 'booked', 'completed', 'converted')
--
-- Existing data: the only legacy value live on this project is 'new'
-- (verified via `SELECT DISTINCT status FROM shop_enquiries`), so widening
-- doesn't conflict with anything in flight.

ALTER TABLE shop_enquiries DROP CONSTRAINT IF EXISTS shop_enquiries_status_check;

ALTER TABLE shop_enquiries
  ADD CONSTRAINT shop_enquiries_status_check
  CHECK (status = ANY (ARRAY[
    'new'::text,
    'read'::text,
    'replied'::text,
    'archived'::text,
    'contacted'::text,
    'booked'::text,
    'completed'::text,
    'converted'::text
  ]));
