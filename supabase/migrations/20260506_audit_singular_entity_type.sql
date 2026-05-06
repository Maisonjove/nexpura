-- A1 followup cluster, item 1 (2026-05-06):
-- audit_sensitive_changes() must emit SINGULAR action prefixes.
--
-- Root cause (R-0003 evidence on tenant 316a3313):
--   Trigger uses TG_TABLE_NAME directly → 'sales.update', 'refunds.insert',
--   'tasks.insert', etc. (plural — postgres convention).
--   App-level logAuditEvent uses singular ('sale', 'refund', 'task').
--   /settings/activity ENTITY_LABELS only knows the singular keys, so
--   trigger rows render as raw lowercase strings AND the dropdown filter
--   (which lists 'Inventory'/'Customer'/etc. but NOT 'Sale'/'Refund'/
--   'Payment') drops them entirely.
--
--   Confirmed via direct query — both 'refund_create' (singular,
--   app-level) AND 'refunds.insert' (plural, trigger) coexist in
--   audit_logs for the same tenant.
--
-- Fix:
--   Replace the function body so the action prefix is the singular form.
--   Explicit CASE map for the irregular forms (sales→sale, refunds→
--   refund, etc.); regular table names (inventory, tasks) need no
--   transform but the CASE block exhausts them defensively.
--
--   Also: write entity_type as the singular form so the row matches
--   ENTITY_LABELS without the cluster-PR item-2 defensive plural→
--   singular alias map being load-bearing for new rows. Item 2 still
--   ships so legacy plural rows (already in audit_logs) render OK.
--
-- Caveat on legacy rows:
--   Existing audit_logs rows retain the plural form. We do NOT backfill
--   — cluster-PR item 2 adds a defensive plural→singular alias to the
--   client component for legacy rows. Going forward all new rows are
--   singular.

BEGIN;

CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $function$
DECLARE
  v_skip text;
  v_headers text;
  v_ip text;
  v_ua text;
  v_singular text;
BEGIN
  -- Wrapper-emit shadow guard (unchanged).
  v_skip := current_setting('audit.skip', true);
  IF v_skip = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Defensive header parse (unchanged).
  v_headers := current_setting('request.headers', true);
  IF v_headers IS NOT NULL AND v_headers <> '' THEN
    BEGIN
      v_ip := v_headers::json ->> 'x-forwarded-for';
      v_ua := v_headers::json ->> 'user-agent';
    EXCEPTION WHEN others THEN
      v_ip := NULL;
      v_ua := NULL;
    END;
  END IF;

  -- Map TG_TABLE_NAME (postgres plural convention) to its singular form.
  -- Goal: action prefix matches the app-level logAuditEvent's singular
  -- action names so /settings/activity ENTITY_LABELS resolves both.
  v_singular := CASE TG_TABLE_NAME
    WHEN 'sales'         THEN 'sale'
    WHEN 'sale_items'    THEN 'sale_item'
    WHEN 'refunds'       THEN 'refund'
    WHEN 'refund_items'  THEN 'refund_item'
    WHEN 'payments'      THEN 'payment'
    WHEN 'invoices'      THEN 'invoice'
    WHEN 'customers'     THEN 'customer'
    WHEN 'repairs'       THEN 'repair'
    WHEN 'bespoke_jobs'  THEN 'bespoke_job'
    WHEN 'team_members'  THEN 'team_member'
    WHEN 'locations'     THEN 'location'
    WHEN 'suppliers'     THEN 'supplier'
    WHEN 'expenses'      THEN 'expense'
    WHEN 'quotes'        THEN 'quote'
    WHEN 'gift_vouchers' THEN 'gift_voucher'
    WHEN 'tasks'         THEN 'task'
    WHEN 'appointments'  THEN 'appointment'
    WHEN 'gl_entries'    THEN 'gl_entry'
    WHEN 'stock_movements' THEN 'stock_movement'
    WHEN 'users'         THEN 'user'
    -- Already singular by convention — keep as-is.
    WHEN 'inventory'     THEN 'inventory'
    WHEN 'tenants'       THEN 'tenant'
    -- Fallback: strip a trailing 's' if present, else use raw name.
    -- Defensive guard for any future audited table that's added to the
    -- trigger list without updating this map.
    ELSE
      CASE
        WHEN TG_TABLE_NAME LIKE '%s' THEN substring(TG_TABLE_NAME from 1 for length(TG_TABLE_NAME) - 1)
        ELSE TG_TABLE_NAME
      END
  END;

  INSERT INTO audit_logs (
    tenant_id, user_id, action, entity_type, entity_id,
    old_data, new_data, ip_address, user_agent, metadata
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    -- Singular '<entity>.<op>' — matches app-level pattern.
    v_singular || '.' || lower(TG_OP),
    v_singular,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    v_ip,
    v_ua,
    jsonb_build_object('source', 'db_trigger')
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

COMMIT;
