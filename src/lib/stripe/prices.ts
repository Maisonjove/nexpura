/**
 * Stripe Price IDs
 * 
 * These are created via the Stripe dashboard or API.
 * Update these values after creating products/prices in Stripe.
 * 
 * Products to create:
 * - Nexpura Basic (metadata: plan=basic)
 * - Nexpura Pro (metadata: plan=pro)
 * - Nexpura Ultimate (metadata: plan=ultimate)
 */
export const STRIPE_PRICES = {
  basic: {
    monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY ?? 'price_basic_monthly_placeholder',
    annual: process.env.STRIPE_PRICE_BASIC_ANNUAL ?? 'price_basic_annual_placeholder',
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_monthly_placeholder',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? 'price_pro_annual_placeholder',
  },
  ultimate: {
    monthly: process.env.STRIPE_PRICE_ULTIMATE_MONTHLY ?? 'price_ultimate_monthly_placeholder',
    annual: process.env.STRIPE_PRICE_ULTIMATE_ANNUAL ?? 'price_ultimate_annual_placeholder',
  },
} as const

export type PlanKey = keyof typeof STRIPE_PRICES
export type IntervalKey = keyof typeof STRIPE_PRICES.basic
