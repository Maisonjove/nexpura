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
 *      - Price 2: AUD $890/year recurring   → copy price ID → STRIPE_PRICE_BOUTIQUE_ANNUAL
 *
 *    Product 2: "Nexpura Studio"
 *      - Add metadata: plan=studio
 *      - Price 1: AUD $179/month recurring → copy price ID → STRIPE_PRICE_STUDIO_MONTHLY
 *      - Price 2: AUD $1790/year recurring  → copy price ID → STRIPE_PRICE_STUDIO_ANNUAL
 *
 *    Product 3: "Nexpura Group"  (custom/contact-sales — set to a nominal amount or free)
 *      - Add metadata: plan=group
 *      - Price 1: AUD $1/month (placeholder until custom quoting is built)
 *                               → copy price ID → STRIPE_PRICE_GROUP_MONTHLY
 *      - Price 2: AUD $1/year   → copy price ID → STRIPE_PRICE_GROUP_ANNUAL
 *
 * 3. Add the 6 price IDs as environment variables in Vercel:
 *    Vercel → Project → Settings → Environment Variables
 *
 *    STRIPE_PRICE_BOUTIQUE_MONTHLY = price_xxxx
 *    STRIPE_PRICE_BOUTIQUE_ANNUAL  = price_xxxx
 *    STRIPE_PRICE_STUDIO_MONTHLY   = price_xxxx
 *    STRIPE_PRICE_STUDIO_ANNUAL    = price_xxxx
 *    STRIPE_PRICE_GROUP_MONTHLY    = price_xxxx
 *    STRIPE_PRICE_GROUP_ANNUAL     = price_xxxx
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
  group: {
    monthly: process.env.STRIPE_PRICE_GROUP_MONTHLY ?? "price_group_monthly_placeholder",
    annual: process.env.STRIPE_PRICE_GROUP_ANNUAL ?? "price_group_annual_placeholder",
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PRICES;
export type IntervalKey = keyof typeof STRIPE_PRICES.boutique;
