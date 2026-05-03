-- Group 15 audit: role-gate sensitive-table writes at the RLS layer.
--
-- Several settings tables are scoped to tenant_id at the RLS layer but
-- have no role check on writes. The application code that reads/writes
-- them goes through admin client + app-layer requireRole, but RLS is
-- the defence-in-depth for direct PostgREST hits with a session token.
--
-- Each of the four tables below stores something owner-sensitive:
--   role_permissions   — permission matrix; mutating your own role's row
--                        grants you owner-equivalent capabilities
--   email_domains      — sender identity for outbound email; spoofing
--   integrations       — third-party API tokens (xero, shopify, whatsapp);
--                        could be exfil'd via SELECT or replaced with
--                        attacker-controlled creds
--   employee_credentials — staff PII + cert document URLs
--
-- This migration tightens the WRITE policies (INSERT / UPDATE / DELETE)
-- to require owner+manager. SELECT remains tenant-scoped (staff need to
-- read their own role permissions; managers need to see integrations
-- list to know what's connected). The narrower SELECT-but-broader-WRITE
-- pattern matches scheduled_reports which already does this correctly.

-- ─── role_permissions ───────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_all_role_permissions ON role_permissions;

CREATE POLICY role_permissions_select ON role_permissions
  FOR SELECT
  USING (tenant_id = get_tenant_id());

CREATE POLICY role_permissions_insert_owner ON role_permissions
  FOR INSERT
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('owner', 'manager', 'admin', 'super_admin')
  );

CREATE POLICY role_permissions_update_owner ON role_permissions
  FOR UPDATE
  USING (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('owner', 'manager', 'admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('owner', 'manager', 'admin', 'super_admin')
  );

CREATE POLICY role_permissions_delete_owner ON role_permissions
  FOR DELETE
  USING (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('owner', 'manager', 'admin', 'super_admin')
  );

-- ─── email_domains ─────────────────────────────────────────────────
-- Drop the existing INSERT/UPDATE/DELETE that has no role check; keep
-- SELECT as-is.
DROP POLICY IF EXISTS tenant_insert_email_domains ON email_domains;
DROP POLICY IF EXISTS tenant_update_email_domains ON email_domains;
DROP POLICY IF EXISTS tenant_delete_email_domains ON email_domains;

CREATE POLICY email_domains_insert_owner ON email_domains
  FOR INSERT
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND get_user_role() = 'owner'
  );

CREATE POLICY email_domains_update_owner ON email_domains
  FOR UPDATE
  USING (
    tenant_id = get_tenant_id()
    AND get_user_role() = 'owner'
  )
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND get_user_role() = 'owner'
  );

CREATE POLICY email_domains_delete_owner ON email_domains
  FOR DELETE
  USING (
    tenant_id = get_tenant_id()
    AND get_user_role() = 'owner'
  );

-- ─── integrations ──────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_insert_integrations ON integrations;
DROP POLICY IF EXISTS tenant_update_integrations ON integrations;
DROP POLICY IF EXISTS tenant_delete_integrations ON integrations;

CREATE POLICY integrations_insert_owner ON integrations
  FOR INSERT
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY integrations_update_owner ON integrations
  FOR UPDATE
  USING (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('owner', 'manager')
  )
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY integrations_delete_owner ON integrations
  FOR DELETE
  USING (
    tenant_id = get_tenant_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- ─── employee_credentials ─────────────────────────────────────────
-- Set up by the Group 14 migration. Currently has two policies (select
-- + ALL modify) both just tenant-scoped. Tighten the modify side.
DROP POLICY IF EXISTS employee_credentials_modify ON employee_credentials;

CREATE POLICY employee_credentials_insert_manager ON employee_credentials
  FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND get_user_role() IN ('owner', 'manager', 'admin', 'super_admin')
  );

CREATE POLICY employee_credentials_update_manager ON employee_credentials
  FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND get_user_role() IN ('owner', 'manager', 'admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND get_user_role() IN ('owner', 'manager', 'admin', 'super_admin')
  );

CREATE POLICY employee_credentials_delete_manager ON employee_credentials
  FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND get_user_role() IN ('owner', 'manager', 'admin', 'super_admin')
  );

-- ─── WITH CHECK hygiene on the * policies relying on USING-fallback ─
-- team_members.team_update, stock_tag_templates.tag_templates_tenant,
-- task_templates.task_templates_tenant_isolation — all rely on PG's
-- USING-fallback for new-row checks. Probe results showed PG 15+ DOES
-- apply USING to new rows when WITH CHECK is null, so this is hygiene
-- not exploit. Drop + recreate with explicit WITH CHECK so a future
-- PG upgrade or RLS change doesn't silently regress.

-- team_members.team_update
DROP POLICY IF EXISTS team_update ON team_members;
CREATE POLICY team_update ON team_members
  FOR UPDATE
  USING (tenant_id = get_tenant_id())
  WITH CHECK (tenant_id = get_tenant_id());

-- stock_tag_templates: was * policy → split into per-command + WITH CHECK
DROP POLICY IF EXISTS tag_templates_tenant ON stock_tag_templates;
CREATE POLICY stock_tag_templates_select ON stock_tag_templates
  FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY stock_tag_templates_insert ON stock_tag_templates
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY stock_tag_templates_update ON stock_tag_templates
  FOR UPDATE
  USING (tenant_id = get_tenant_id())
  WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY stock_tag_templates_delete ON stock_tag_templates
  FOR DELETE USING (tenant_id = get_tenant_id());

-- task_templates: same shape
DROP POLICY IF EXISTS task_templates_tenant_isolation ON task_templates;
CREATE POLICY task_templates_select ON task_templates
  FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY task_templates_insert ON task_templates
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY task_templates_update ON task_templates
  FOR UPDATE
  USING (tenant_id = get_tenant_id())
  WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY task_templates_delete ON task_templates
  FOR DELETE USING (tenant_id = get_tenant_id());

-- locations.tenant_all_locations: already has WITH CHECK; leave it.
