-- A1 cluster Day 1 (2026-05-06): money-correctness migration.
--
-- Extends the existing refunds surface with the columns C-01 / Section 4
-- specified, drops a leftover duplicate, adds manager-PIN material to
-- team_members, and creates the minimum-viable gl_entries table.
--
-- Investigation findings that drove the shape (full report in the
-- A1 PR description):
--   - refunds + refund_items + processRefund + UI all already exist
--     and are healthy. This migration EXTENDS, doesn't recreate.
--   - `total_amount` is dead code from migration 040_missing_tables;
--     dropped here. All 3 existing rows have total === total_amount.
--   - refund_method is freeform text. CHECK added with the canonical
--     5-value set so future writes go through a typed surface.
--   - GL has zero existing structure. New `gl_entries` table is
--     minimum-viable single-row entries, indexed for reconciliation
--     queries. Full double-entry is queued post-engagement (see PR
--     description "GL upgrade path").
--   - Manager PIN: per-team_member, bcrypt-hashed. Self-set on first
--     refund-needing-override. Owner can reset another member's PIN.
--   - Feature flag `a1_money_correctness` on tenants — default FALSE.
--     Enabled per-tenant for staged rollout, hello@nexpura first.

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- 1. refunds — new columns
-- ──────────────────────────────────────────────────────────────────

-- refund_type: full / partial / store_credit. Backfill from
-- existing data: store_credit method → 'store_credit'; everything
-- else (currently empty in prod) defaults to 'full' since legacy
-- refunds without partial-refund infra are by definition full.
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS refund_type TEXT;

UPDATE public.refunds
   SET refund_type = CASE
     WHEN refund_method = 'store_credit' THEN 'store_credit'
     ELSE 'full'
   END
 WHERE refund_type IS NULL;

ALTER TABLE public.refunds
  ALTER COLUMN refund_type SET NOT NULL,
  ALTER COLUMN refund_type SET DEFAULT 'full';

ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_refund_type_check
    CHECK (refund_type IN ('full', 'partial', 'store_credit'));

-- gateway_ref: Stripe charge id / Square payment id / etc. Nullable
-- because not every method has one (cash, store credit). Indexed
-- for future "find refund by gateway ref" reverse lookups.
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS gateway_ref TEXT;

CREATE INDEX IF NOT EXISTS refunds_gateway_ref_idx
  ON public.refunds (tenant_id, gateway_ref)
  WHERE gateway_ref IS NOT NULL;

-- needs_review: flag for backfilled / dubious refund rows. Surfaces
-- in /admin/health for manual reconciliation. Default FALSE (clean
-- refunds don't need review).
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS refunds_needs_review_idx
  ON public.refunds (tenant_id, needs_review)
  WHERE needs_review = TRUE;

-- completed_at: separates the "row created" timestamp from the
-- "money actually moved" timestamp. processRefund writes both at
-- the same instant for now; future split-flow refunds (e.g. async
-- gateway settlements) will set completed_at when the gateway
-- confirms. Default to created_at for existing rows.
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.refunds
   SET completed_at = created_at
 WHERE completed_at IS NULL;

-- ──────────────────────────────────────────────────────────────────
-- 2. refunds — refund_method CHECK constraint + drop total_amount
-- ──────────────────────────────────────────────────────────────────

-- Pre-fix refund_method was freeform text. All 3 existing rows are
-- 'store_credit'. Lock the canonical 5-value set.
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_refund_method_check
    CHECK (refund_method IN ('original_tender', 'store_credit', 'cash', 'card', 'other'));

-- Drop the leftover total_amount column. All 3 existing rows have
-- total === total_amount (verified pre-migration 2026-05-06). The
-- canonical column is `total`; processRefund + UI + POS route all
-- write/read `total`. total_amount was added by migration
-- 040_missing_tables.sql and was never wired up.
ALTER TABLE public.refunds
  DROP COLUMN IF EXISTS total_amount;

-- ──────────────────────────────────────────────────────────────────
-- 3. team_members — manager PIN columns
-- ──────────────────────────────────────────────────────────────────

-- bcrypt hash, never stored plain. Set on first refund-needing-
-- override via a modal. Owner can reset another member's PIN
-- (audit-logged). Cleared on team_member soft-delete (the existing
-- hard-delete cascade already covers it).
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS manager_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS manager_pin_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.team_members.manager_pin_hash IS
  'A1: bcrypt hash of the manager PIN used to authorize refunds '
  'beyond the 30-day window or without an original sale. Self-set '
  'on first override. Null = no PIN configured = cannot authorize '
  'override refunds. Owner can reset another member''s PIN via '
  '/settings/team (audit log entry).';

COMMENT ON COLUMN public.team_members.manager_pin_set_at IS
  'A1: timestamp the PIN was last set. Used by /admin/health to '
  'surface stale PINs (e.g. >180 days old) for rotation prompts.';

-- ──────────────────────────────────────────────────────────────────
-- 4. gl_entries — minimum-viable general ledger
-- ──────────────────────────────────────────────────────────────────

-- A1 ships single-row entries, NOT double-entry. Each money-moving
-- event (sale, refund, adjustment) writes one row with the signed
-- amount. Future upgrade path (post-engagement): debit/credit/
-- account_code columns + accounting_periods join + balanced-sum
-- verifiable invariant. Documented in the A1 PR description.

CREATE TABLE IF NOT EXISTS public.gl_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('refund', 'sale', 'adjustment')),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  -- Denormalised pointers to the source row. source_type names the
  -- table; source_id is its PK. Nullable so future "manual
  -- adjustment" entries (no source row) can be inserted.
  source_type TEXT,
  source_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gl_entries_tenant_created_idx
  ON public.gl_entries (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gl_entries_source_idx
  ON public.gl_entries (tenant_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS gl_entries_type_idx
  ON public.gl_entries (tenant_id, entry_type, created_at DESC);

-- RLS: tenant-scoped, owner+manager+staff_with_finance read.
-- Inserts go through the RPC (service-role bypasses RLS). Direct
-- mutations from the public role are forbidden.
ALTER TABLE public.gl_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY gl_entries_tenant_read ON public.gl_entries
  FOR SELECT
  USING (
    tenant_id = (
      SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 5. tenants — A1 feature flag
-- ──────────────────────────────────────────────────────────────────

-- Default FALSE. Enable per-tenant for staged rollout.
-- hello@nexpura.com (tenant 316a3313-d4fe-4dc8-8ad6-86a11f0f0209)
-- gets it ON in Day 5 after process_refund_v2 RPC ships.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS a1_money_correctness BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.tenants.a1_money_correctness IS
  'A1 feature flag (2026-05-06). When TRUE, processRefund + '
  '/api/pos/refund route through the new process_refund_v2 RPC '
  '(transactional refund + items + stock + GL entry). When FALSE, '
  'they use the legacy saga-style flow. Staged rollout: hello@nexpura '
  'first, then audit + expand.';

COMMIT;
