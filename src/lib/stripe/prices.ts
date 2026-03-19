/**
 * Stripe Price IDs — Nexpura Subscription Plans
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNER ACTION REQUIRED — How to wire up Stripe billing:
 *
 * 1. Log in to dashboard.stripe.com
 * 2. Create 3 Products (Products → Add product):
 *
 *    Product 1: "Nexpura Boutique"
 *      - Add metadata: plan=boutique
 *      - Price 1: AUD $89/month recurring  → copy price ID → STRIPE_PRICE_BOUTIQUE_MONTHLY
 *      - Price 2: AUD $854/year recurring (89×12×0.8=$854.40 rounded)  → copy price ID → STRIPE_PRICE_BOUTIQUE_ANNUAL
 *
 *    Product 2: "Nexpura Studio"
 *      - Add metadata: plan=studio
 *      - Price 1: AUD $179/month recurring → copy price ID → STRIPE_PRICE_STUDIO_MONTHLY
 *      - Price 2: AUD $1,718/year recurring (179×12×0.8=$1718.40 rounded) → copy price ID → STRIPE_PRICE_STUDIO_ANNUAL
 *
 *    Product 3: "Nexpura Atelier"
 *      - Add metadata: plan=atelier
 *      - Price 1: AUD $299/month recurring → copy price ID → STRIPE_PRICE_ATELIER_MONTHLY
 *      - Price 2: AUD $2,870/year recurring (299×12×0.8=$2870.40 rounded) → copy price ID → STRIPE_PRICE_ATELIER_ANNUAL
 *
 * 3. Add the 6 price IDs as environment variables in Vercel:
 *    Vercel → Project → Settings → Environment Variables
 *
 *    STRIPE_PRICE_BOUTIQUE_MONTHLY = price_xxxx
 *    STRIPE_PRICE_BOUTIQUE_ANNUAL  = price_xxxx
 *    STRIPE_PRICE_STUDIO_MONTHLY   = price_xxxx
 *    STRIPE_PRICE_STUDIO_ANNUAL    = price_xxxx
 *    STRIPE_PRICE_ATELIER_MONTHLY  = price_xxxx
 *    STRIPE_PRICE_ATELIER_ANNUAL   = price_xxxx
 *
 * 4. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET — already done in Vercel ✅
 *
 * 5. Configure the Stripe webhook endpoint in dashboard.stripe.com:
 *    Endpoint URL: https://nexpura.com/api/stripe/webhook
 *    Events to listen for:
 *      - customer.subscription.created
 *      - customer.subscription.updated
 *      - customer.subscription.deleted
 *      - invoice.payment_succeeded
 *      - invoice.payment_failed
 *
 * Until the env vars are set, Stripe checkout will use placeholder price IDs
 * and will fail gracefully in the billing UI.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const STRIPE_PRICES = {
  boutique: {
    monthly: process.env.STRIPE_PRICE_BOUTIQUE_MONTHLY ?? "price_boutique_monthly_placeholder",
    annual: process.env.STRIPE_PRICE_BOUTIQUE_ANNUAL ?? "price_boutique_annual_placeholder",
  },
  studio: {
    monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY ?? "price_studio_monthly_placeholder",
    annual: process.env.STRIPE_PRICE_STUDIO_ANNUAL ?? "price_studio_annual_placeholder",
  },
  atelier: {
    monthly: process.env.STRIPE_PRICE_ATELIER_MONTHLY ?? "price_atelier_monthly_placeholder",
    annual: process.env.STRIPE_PRICE_ATELIER_ANNUAL ?? "price_atelier_annual_placeholder",
  },
  // Legacy alias — keep so any old checkout calls don't break
  group: {
    monthly: process.env.STRIPE_PRICE_ATELIER_MONTHLY ?? "price_atelier_monthly_placeholder",
    annual: process.env.STRIPE_PRICE_ATELIER_ANNUAL ?? "price_atelier_annual_placeholder",
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PRICES;
export type IntervalKey = keyof typeof STRIPE_PRICES.boutique;
