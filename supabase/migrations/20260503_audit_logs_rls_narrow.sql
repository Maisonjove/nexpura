-- audit_logs RLS narrow to match the application guard — Group 15 audit.
--
-- /settings/activity/page.tsx line 28 hard-gates the activity-log surface to
--   ["admin", "owner", "super_admin"]
-- (manager and staff are denied with an "Access Denied" page). The RLS
-- policy `audit_logs_select_manager` is misnamed and lacks a role check —
-- its qual is just `tenant_id = get_tenant_id()`. Net: a staff member
-- hitting PostgREST directly with their session token bypasses the page
-- gate and reads every settings-change / banking-update / role-change
-- record on their tenant. Audit logs are sensitive (banking + role +
-- settings churn = who did what + when, plus pii on referenced entities).
--
-- Fix: tighten the SELECT policy to require role IN
-- ('admin', 'owner', 'super_admin'), matching the page guard exactly.
-- Defence-in-depth — the page already gates, but RLS is the layer that
-- catches direct REST hits.

DROP POLICY IF EXISTS "audit_logs_select_manager" ON audit_logs;

CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT
  USING (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('admin', 'owner', 'super_admin')
  );
