-- PR-02 / W6-CRIT-06: scheduled_reports distribute tenant-wide revenue/PII
-- to caller-supplied email addresses. Writes must be gated to owner at the
-- DB layer too (defence-in-depth vs the server-action gate in
-- /settings/reports/actions.ts — if a client ever bypasses the action, RLS
-- should still refuse the write).
--
-- SELECT stays tenant-scoped so every staffer can see the list (they only
-- can't create/edit/delete). Reads are used by the settings page + cron.

DO $$
BEGIN
  -- Drop the permissive INSERT/UPDATE/DELETE policies if they exist.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reports' AND policyname='scheduled_reports_insert') THEN
    DROP POLICY "scheduled_reports_insert" ON public.scheduled_reports;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reports' AND policyname='scheduled_reports_update') THEN
    DROP POLICY "scheduled_reports_update" ON public.scheduled_reports;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reports' AND policyname='scheduled_reports_delete') THEN
    DROP POLICY "scheduled_reports_delete" ON public.scheduled_reports;
  END IF;
END $$;

-- Only owners can insert/update/delete. Role is pulled from public.users.
CREATE POLICY "scheduled_reports_insert_owner"
  ON public.scheduled_reports
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "scheduled_reports_update_owner"
  ON public.scheduled_reports
  FOR UPDATE
  USING (
    tenant_id = public.get_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "scheduled_reports_delete_owner"
  ON public.scheduled_reports
  FOR DELETE
  USING (
    tenant_id = public.get_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'owner'
    )
  );
