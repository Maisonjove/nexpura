-- C-05: Activity Log empty despite many writes
--
-- Root cause:
--   The `audit_logs` table is the data source for /settings/activity, but
--   only ~5 server actions emit to it via logAuditEvent(). The rest of
--   the codebase mutates Supabase tables directly (`from('x').update()`)
--   with no surrounding emit. As a result the page was nearly empty in
--   production (278 rows across 5 tenants over the entire lifetime of
--   the app — should be tens of thousands).
--
-- Fix layer: route + DB (Option D, combo).
--   * Route-level wrapper (withAuditLog) emits semantic actions
--     ('invoice_create', 'invite_accept', etc.) when the handler can be
--     intercepted at the export boundary. This is the path that
--     captures user_id, ip_address, user_agent and rich payloads from
--     the request context.
--   * DB triggers are the safety net — anything that escapes the route
--     wrapper (server actions writing through admin client, RPCs,
--     migrations done via the dashboard, third-party integrations
--     hitting the REST endpoint directly) still leaves an audit row.
--
-- Why both layers?
--   The route wrapper alone misses any code path that doesn't go
--   through a wrapped handler (server actions, cron, integrations).
--   The DB trigger alone gives us TG_OP-level rows ('UPDATE','INSERT',
--   'DELETE') but no semantic action name, no request user_id when the
--   service-role admin client is used, and no IP/UA. Together: the
--   trigger guarantees a row exists for every mutation, the wrapper
--   upgrades it (or replaces it) with the rich row when available.
--
-- Allow-list / deny-list rationale below (read carefully before
-- adding/removing tables — the choices here directly affect the noise
-- floor of /settings/activity).

BEGIN;

-- 1. Replace the trigger function with a version that:
--    * Tags the row with TG_TABLE_NAME-prefixed action ('inventory.update'
--      etc) so the UI can filter on entity_type alone if it wants the
--      simple grouping, or on action prefix for fine-grained.
--    * Skips emit when current_setting('audit.skip', true) = 'true'.
--      The route wrapper sets this via SET LOCAL before its own update,
--      so the wrapper's rich row isn't shadowed by a redundant trigger
--      row for the same write. Outside a wrapper the GUC is unset, the
--      trigger emits as the safety-net source-of-truth.
--    * Falls back gracefully when current_setting('request.headers',
--      true) is NULL (e.g. when called from psql or a server action via
--      the admin client) — previous version would crash on `::json` of
--      NULL.

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
BEGIN
  -- Wrapper-emit shadow guard: if the route wrapper has already
  -- emitted (or will emit) the rich row for this write, suppress the
  -- trigger row to avoid double-counting in the UI. The wrapper sets
  --   SET LOCAL audit.skip = 'true';
  -- before its admin-client write inside the same transaction.
  v_skip := current_setting('audit.skip', true);
  IF v_skip = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Defensive header parse — request.headers is unset when invoked
  -- from server actions (admin client) or psql.
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

  INSERT INTO audit_logs (
    tenant_id, user_id, action, entity_type, entity_id,
    old_data, new_data, ip_address, user_agent, metadata
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    -- Compose semantic-ish action: '<table>.<op>'. The route wrapper
    -- emits a higher-fidelity action like 'invoice_create' and sets
    -- audit.skip so we never double up; this is the safety-net
    -- format and is filterable in the UI.
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
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

-- 2. Apply the trigger to high-write tables that aren't already covered.
--
-- ALLOW-LIST (audit-on):
--   sales, sale_items, inventory, customers (already partial — extend),
--   repairs, bespoke_jobs, team_members, locations, suppliers, expenses,
--   quotes, gift_vouchers, tasks, appointments
--
-- DENY-LIST (deliberately NOT audited — would drown the log):
--   audit_logs               — recursion
--   activity_log             — separate table, separate logger
--   admin_audit_logs         — separate platform-ops audit
--   webhook_audit_log        — separate inbound-webhook audit
--   sessions / user_sessions — high-volume, separately tracked
--   login_attempts / login_lockouts / login_alerts — security, separate
--   rate_limit_buckets       — purely operational
--   tenant_dashboard_stats   — derived, recomputed often
--   notifications / sms_sends / whatsapp_sends / email_sends / email_logs
--                            — message bus, separate observability
--   stock_movements          — derived from sales/transfers
--   passport_events / job_events / order_status_history / passports's
--      internal event tables — already event-sourced
--   migration_*              — admin-only, separate audit
--   pilot_issues / qa_*      — internal QA tooling
--   pg_timezone_names        — postgres metadata view
--   ai_messages / ai_conversations — internal LLM traffic
--   role_permissions / website_config / settings — config-style, low volume
--      and the wrapper covers `settings_update` already
--   eod_reconciliations      — already emits via wrapper as eod_submit
--
-- Existing triggers are left in place so we don't churn migrations:
--   payments, refunds, invoices, customers (store_credit only),
--   users (role/tenant_id only). The trigger function rewrite above
--   updates their behaviour automatically.

DO $$
DECLARE
  t text;
  trigger_name text;
  tables text[] := ARRAY[
    'sales',
    'sale_items',
    'inventory',
    'repairs',
    'bespoke_jobs',
    'team_members',
    'locations',
    'suppliers',
    'expenses',
    'quotes',
    'gift_vouchers',
    'tasks',
    'appointments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    trigger_name := 'audit_' || t || '_changes';
    -- Idempotent: drop+recreate so re-running the migration is safe.
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_changes()',
      trigger_name, t
    );
  END LOOP;
END;
$$;

-- 3. Sanity check — index on (tenant_id, created_at desc) supports the
--    UI query in /settings/activity. Created idempotently in case it
--    already exists from a prior migration.
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx
  ON public.audit_logs (tenant_id, created_at DESC);

COMMIT;
