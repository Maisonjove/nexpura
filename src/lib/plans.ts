import { PLANS, type CurrencyCode } from '@/data/pricing';

export type PlanId = 'boutique' | 'studio' | 'atelier';

export interface PlanFeatures {
  staffLimit: number | null;
  multiStore: boolean;
  websiteBuilder: boolean;
  fullAnalytics: boolean;
  aiCopilot: boolean;
  aiFeatures: boolean;
  aiWebsiteCopy: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  boutique: { staffLimit: 1, multiStore: false, websiteBuilder: false, fullAnalytics: false, aiCopilot: false, aiFeatures: false, aiWebsiteCopy: false, customDomain: false, whiteLabel: false, prioritySupport: false },
  studio: { staffLimit: 5, multiStore: false, websiteBuilder: true, fullAnalytics: true, aiCopilot: true, aiFeatures: true, aiWebsiteCopy: false, customDomain: false, whiteLabel: false, prioritySupport: true },
  atelier: { staffLimit: null, multiStore: true, websiteBuilder: true, fullAnalytics: true, aiCopilot: true, aiFeatures: true, aiWebsiteCopy: true, customDomain: true, whiteLabel: true, prioritySupport: true },
};

export const PLAN_NAMES: Record<PlanId, string> = { boutique: 'Boutique', studio: 'Studio', atelier: 'Atelier' };

// AUD-only display string. Kept for legacy callers (PlanGate component,
// marketing breadcrumbs) where a quick text label was needed without
// the multi-currency lookup. New code should resolve via
// src/data/pricing.ts → PLANS to get the actual currency-correct price.
export const PLAN_PRICES: Record<PlanId, string> = { boutique: '$149/mo', studio: '$299/mo', atelier: '$499/mo' };

const PLAN_ORDER: PlanId[] = ['boutique', 'studio', 'atelier'];

// ───────────────────────────────────────────────────────────────────
// Per-currency MRR — Joey 2026-05-03 directive after Group 16
// ───────────────────────────────────────────────────────────────────
//
// An AUD-baseline MRR table silently misreports for non-AUD subs:
// USD Studio pays $199/mo (≈AUD 308), GBP Studio pays £159 (≈AUD 304),
// EUR Studio pays €179 (≈AUD 295). Reporting them all as "AUD $299"
// because they're labeled "studio" inflates AUD-MRR for the
// non-AUD-paying tenants.
//
// Right shape: lookup priority per subscription:
//   1. If sub.stripe_price_id is set, find PLANS[*].pricing[*].stripePriceId
//      match → that gives canonical (plan, currency, amount).
//   2. Else if sub.currency is set (column added in
//      20260503_subscriptions_currency_priceid.sql, populated by
//      stripe webhook), use {sub.plan, sub.currency} → PLANS lookup.
//   3. Else fallback to tenant.currency + sub.plan → PLANS lookup
//      (covers the existing admin-set "active" subs that never went
//      through Stripe; their currency is inferred from tenant settings).
//   4. Else skip — no signal at all.
//
// Definition: paying-only, exclude is_free_forever.

export type CurrencyMRR = Partial<Record<CurrencyCode, number>>;

export interface SubForMRR {
  plan: string | null;
  status: string | null;
  tenant_id?: string;
  /** stripe_price_id column added 2026-05-03 — populated by webhook
   *  on customer.subscription.created/updated. NULL for admin-set
   *  active subs that never went through Stripe checkout. */
  stripe_price_id?: string | null;
  /** currency column added 2026-05-03 — webhook copies it from the
   *  Stripe subscription's default_currency. NULL for admin-set subs. */
  currency?: string | null;
}

export interface TenantForMRR {
  is_free_forever?: boolean | null;
  currency?: string | null;
}

const SUPPORTED: CurrencyCode[] = ['AUD', 'USD', 'GBP', 'EUR'];

function isSupportedCurrency(c: string | null | undefined): c is CurrencyCode {
  return !!c && (SUPPORTED as string[]).includes(c.toUpperCase());
}

function canonicalisePlanKey(plan: string): PlanId | null {
  if (plan === 'group' || plan === 'ultimate') return 'atelier';
  if (plan === 'basic') return 'boutique';
  if (plan === 'pro') return 'studio';
  if (plan === 'boutique' || plan === 'studio' || plan === 'atelier') return plan;
  return null;
}

export interface ResolvedAmount {
  currency: CurrencyCode;
  amount: number;
  /** "stripe" | "tenant_fallback" — surfaced so the UI can disclose
   *  when MRR includes admin-set subs whose currency was inferred
   *  rather than recorded by Stripe. */
  source: 'stripe' | 'tenant_fallback';
}

/**
 * Resolve the (currency, amount) for a single subscription using the
 * lookup priority above. Returns null if no signal at all.
 */
export function resolveSubAmount(
  sub: SubForMRR,
  tenants?: Map<string, TenantForMRR>,
): ResolvedAmount | null {
  // (1) stripe_price_id direct match
  if (sub.stripe_price_id) {
    for (const p of PLANS) {
      for (const cur of SUPPORTED) {
        if (p.pricing[cur]?.stripePriceId === sub.stripe_price_id) {
          return { currency: cur, amount: p.pricing[cur].amount, source: 'stripe' };
        }
      }
    }
  }
  if (!sub.plan) return null;
  const planKey = canonicalisePlanKey(sub.plan);
  if (!planKey) return null;
  const planRow = PLANS.find((p) => p.id === planKey);
  if (!planRow) return null;

  // (2) sub.currency direct
  if (isSupportedCurrency(sub.currency)) {
    const cur = sub.currency!.toUpperCase() as CurrencyCode;
    return { currency: cur, amount: planRow.pricing[cur].amount, source: 'stripe' };
  }
  // (3) tenant.currency fallback
  const t = sub.tenant_id ? tenants?.get(sub.tenant_id) : undefined;
  if (isSupportedCurrency(t?.currency)) {
    const cur = (t!.currency!).toUpperCase() as CurrencyCode;
    return { currency: cur, amount: planRow.pricing[cur].amount, source: 'tenant_fallback' };
  }
  // (4) no signal
  return null;
}

export interface MRRBreakdown {
  byCurrency: CurrencyMRR;
  /** How many of the contributing subs were resolved via the
   *  tenant-currency fallback rather than a real Stripe price_id. The
   *  /admin/revenue UI shows a small parenthetical when this is non-
   *  zero so the multi-currency total isn't presented as fully Stripe-
   *  backed when it isn't. */
  fallbackSubCount: number;
  /** Total subs counted (across all currencies + sources). */
  totalSubCount: number;
}

export function calculateMRRByCurrency(
  subs: SubForMRR[],
  tenants?: Map<string, TenantForMRR>,
): MRRBreakdown {
  const byCurrency: CurrencyMRR = {};
  let fallbackSubCount = 0;
  let totalSubCount = 0;
  for (const s of subs) {
    if (s.status !== 'active') continue;
    if (!s.tenant_id) continue;
    const t = tenants?.get(s.tenant_id);
    if (t?.is_free_forever) continue;
    const resolved = resolveSubAmount(s, tenants);
    if (!resolved) continue;
    byCurrency[resolved.currency] = (byCurrency[resolved.currency] ?? 0) + resolved.amount;
    totalSubCount++;
    if (resolved.source === 'tenant_fallback') fallbackSubCount++;
  }
  return { byCurrency, fallbackSubCount, totalSubCount };
}

export function calculateProjectedMRRByCurrency(
  subs: SubForMRR[],
  tenants?: Map<string, TenantForMRR>,
): MRRBreakdown {
  const byCurrency: CurrencyMRR = {};
  let fallbackSubCount = 0;
  let totalSubCount = 0;
  for (const s of subs) {
    if (s.status !== 'active' && s.status !== 'trialing') continue;
    if (!s.tenant_id) continue;
    const t = tenants?.get(s.tenant_id);
    if (t?.is_free_forever) continue;
    const resolved = resolveSubAmount(s, tenants);
    if (!resolved) continue;
    byCurrency[resolved.currency] = (byCurrency[resolved.currency] ?? 0) + resolved.amount;
    totalSubCount++;
    if (resolved.source === 'tenant_fallback') fallbackSubCount++;
  }
  return { byCurrency, fallbackSubCount, totalSubCount };
}

const SYMBOLS: Record<CurrencyCode, string> = { AUD: 'A$', USD: 'US$', GBP: '£', EUR: '€' };
const FMT_ORDER: CurrencyCode[] = ['AUD', 'USD', 'GBP', 'EUR'];

/**
 * Format a CurrencyMRR object for inline display.
 * "A$1,200 · US$800 · £400 · €200" — only emits currencies with a
 * non-zero MRR. Returns "A$0" if all-zero.
 */
export function formatMRRByCurrency(mrr: CurrencyMRR): string {
  const parts: string[] = [];
  for (const c of FMT_ORDER) {
    const v = mrr[c];
    if (v && v > 0) parts.push(`${SYMBOLS[c]}${v.toLocaleString()}`);
  }
  return parts.length === 0 ? 'A$0' : parts.join(' · ');
}

/**
 * Format a single currency line for the /admin/revenue 4-line stack.
 * Always emits even when zero (per Joey: 4 lines visible) — falsy
 * caller can choose to skip zero rows.
 */
export function formatCurrencyLine(currency: CurrencyCode, amount: number): string {
  return `${SYMBOLS[currency]}${(amount ?? 0).toLocaleString()}`;
}

// ───────────────────────────────────────────────────────────────────
// FX-converted AUD total (Joey 2026-05-03 spec)
// ───────────────────────────────────────────────────────────────────
//
// Convention: the consolidated total is shown ONLY with "≈" prefix and
// "(FX rates updated daily)" parenthetical. Never present as exact.
// If any rate is missing or stale (> 7 days) the total renders as
// "≈ A$— (FX rate stale)" — see /admin/revenue.

export const FX_STALE_THRESHOLD_DAYS = 7;

export interface FxRate {
  base: CurrencyCode;
  target: CurrencyCode;
  rate: number;
  fetchedAt: Date;
}

export type FxLookup = (base: CurrencyCode, target: CurrencyCode) => FxRate | null;

/**
 * Convert a per-currency MRR breakdown to a single AUD figure using the
 * provided FX lookup. Returns:
 *   { audTotal: number, isStale: false } when all conversions found a
 *     rate ≤ FX_STALE_THRESHOLD_DAYS old.
 *   { audTotal: null,  isStale: true  } when ANY non-zero foreign-
 *     currency line lacked a rate or had a rate older than the
 *     threshold. The /admin UI renders "≈ A$—" in this branch.
 *
 * AUD lines pass through unchanged (no FX needed).
 */
export function convertMRRToAUD(
  mrr: CurrencyMRR,
  lookup: FxLookup,
  now: Date = new Date(),
): { audTotal: number | null; isStale: boolean } {
  const STALE_MS = FX_STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  let total = 0;
  for (const cur of SUPPORTED) {
    const v = mrr[cur];
    if (!v || v === 0) continue;
    if (cur === 'AUD') {
      total += v;
      continue;
    }
    const rate = lookup(cur, 'AUD');
    if (!rate) return { audTotal: null, isStale: true };
    if (now.getTime() - rate.fetchedAt.getTime() > STALE_MS) {
      return { audTotal: null, isStale: true };
    }
    total += v * rate.rate;
  }
  return { audTotal: Math.round(total), isStale: false };
}

// ───────────────────────────────────────────────────────────────────
// Legacy single-figure MRR helpers — kept as thin wrappers for any
// existing call sites that haven't migrated. New code uses the
// per-currency variants above.
// ───────────────────────────────────────────────────────────────────

/**
 * @deprecated — use calculateMRRByCurrency instead.
 * Returns just the AUD slice. Misses non-AUD MRR — see Joey's
 * 2026-05-03 directive on AUD-baseline silent misreporting.
 */
export function calculateMRR(
  subs: SubForMRR[],
  tenants?: Map<string, TenantForMRR>,
): number {
  return calculateMRRByCurrency(subs, tenants).byCurrency.AUD ?? 0;
}

/** @deprecated — use calculateProjectedMRRByCurrency instead. */
export function calculateProjectedMRR(
  subs: SubForMRR[],
  tenants?: Map<string, TenantForMRR>,
): number {
  return calculateProjectedMRRByCurrency(subs, tenants).byCurrency.AUD ?? 0;
}

// ───────────────────────────────────────────────────────────────────
// Plan-feature helpers (unchanged from pre-cleanup)
// ───────────────────────────────────────────────────────────────────

export function planIncludes(userPlan: PlanId, feature: keyof Omit<PlanFeatures, 'staffLimit'>): boolean {
  return PLAN_FEATURES[userPlan ?? 'boutique']?.[feature] === true;
}

export function getMinPlanForFeature(feature: keyof Omit<PlanFeatures, 'staffLimit'>): PlanId | null {
  for (const p of PLAN_ORDER) {
    if (PLAN_FEATURES[p][feature]) return p;
  }
  return null;
}

export function getUpgradePlan(userPlan: PlanId, feature: keyof Omit<PlanFeatures, 'staffLimit'>): PlanId | null {
  return planIncludes(userPlan, feature) ? null : getMinPlanForFeature(feature);
}

export function canAddStaff(userPlan: PlanId, currentCount: number): boolean {
  const limit = PLAN_FEATURES[userPlan]?.staffLimit;
  return limit === null || currentCount < limit;
}
