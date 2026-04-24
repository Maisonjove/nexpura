-- Perf finding #9 from the retest.
--
-- 12 tenant-scoped tables were missing a `(tenant_id, created_at DESC)`
-- composite index. Listing pages on every one of them does
-- `ORDER BY created_at DESC LIMIT N WHERE tenant_id = $1` and then
-- falls back to a tenant scan + in-memory sort. Today cheap because
-- row counts are small; linearly grows with tenant age.
--
-- All indexes CREATE IF NOT EXISTS so re-runs are no-ops. CONCURRENTLY
-- is NOT used because Supabase's migration pipeline requires statements
-- to run inside a transaction (CONCURRENTLY can't). Row counts are
-- small enough that the brief exclusive lock is imperceptible.

CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_at_idx
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS communications_tenant_created_at_idx
  ON public.communications (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS expenses_tenant_created_at_idx
  ON public.expenses (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_tenant_created_at_idx
  ON public.payments (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tasks_tenant_created_at_idx
  ON public.tasks (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS appointments_tenant_created_at_idx
  ON public.appointments (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS purchase_orders_tenant_created_at_idx
  ON public.purchase_orders (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS appraisals_tenant_created_at_idx
  ON public.appraisals (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS memo_items_tenant_created_at_idx
  ON public.memo_items (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS eod_reconciliations_tenant_created_at_idx
  ON public.eod_reconciliations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stock_movements_tenant_created_at_idx
  ON public.stock_movements (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_tenant_created_at_idx
  ON public.notifications (tenant_id, created_at DESC);
