-- subscriptions.stripe_price_id + subscriptions.currency — Phase 1.5
-- post-audit (Joey 2026-05-03 directive: per-currency MRR).
--
-- Why: pre-fix the only Stripe linkage on subscriptions was
-- stripe_sub_id; price_id and currency had to be fetched from Stripe
-- on every MRR calc, which meant the multi-currency breakdown either
-- did N round-trips per page load or guessed via tenant.currency.
-- Both bad. Adding the columns lets calculateMRRByCurrency in
-- src/lib/plans.ts read price_id directly and cross-reference
-- src/data/pricing.ts for the canonical (plan, currency, amount).
--
-- Both columns are nullable — existing admin-set "active" subs
-- (currently 4 on prod, see PR description) have no Stripe linkage
-- and the columns will stay null until the next webhook event fires.
-- The new src/app/api/webhooks/stripe handler populates them on
-- customer.subscription.created/updated.
--
-- Currency uses the same 4-letter ISO codes the marketing pricing
-- file uses (AUD/USD/GBP/EUR). Stripe sends lowercase by convention;
-- the webhook upper-cases before write.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT;

CREATE INDEX IF NOT EXISTS subscriptions_stripe_price_id_idx
  ON subscriptions(stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_currency_idx
  ON subscriptions(currency)
  WHERE currency IS NOT NULL;

-- Document the supported currencies for downstream readers / RLS.
COMMENT ON COLUMN subscriptions.currency
  IS 'ISO 4217 currency code (AUD/USD/GBP/EUR). Populated by Stripe webhook from subscription.currency. NULL for admin-set subs that never went through Stripe checkout.';

COMMENT ON COLUMN subscriptions.stripe_price_id
  IS 'Stripe price ID (price_xxx). Populated by webhook from subscription.items.data[0].price.id. NULL until first webhook event fires for the sub.';
