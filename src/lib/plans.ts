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
          export const PLAN_PRICES: Record<PlanId, string> = { boutique: '$89/mo', studio: '$179/mo', atelier: '$299/mo' };

          // Canonical numeric monthly price per plan in USD/AUD (display
          // uses AUD via Intl.NumberFormat; the underlying number is the
          // same). Used by /admin, /admin/tenants, /admin/revenue MRR
          // calculations to prevent the 3-way drift Group 16 surfaced
          // (where /admin showed $2,451, /admin/tenants $179, and
          // /admin/revenue $1,076 from the same dataset).
          //
          // Includes legacy plan keys (group/basic/pro/ultimate) so
          // historical subscription rows that still carry them still
          // count toward MRR. New code should only emit the canonical
          // {boutique, studio, atelier} keys.
          export const PLAN_PRICE_PER_MONTH: Record<string, number> = {
            boutique: 89,
            studio: 179,
            atelier: 299,
            // Legacy keys — same prices as their canonical aliases.
            group: 299,
            basic: 89,
            pro: 179,
            ultimate: 299,
          };

          /**
           * Canonical MRR calculation for the admin dashboard.
           *
           * Definition: sum of monthly plan price across PAYING tenants.
           * "Paying" means status='active' AND not flagged is_free_forever.
           *
           * Pre-fix the three admin pages disagreed:
           *   - /admin index: included trialing + free-forever, $2,451
           *   - /admin/tenants: only active, but PLAN_MRR was missing
           *     'atelier' so all atelier subs counted as $0, total $179
           *   - /admin/revenue: only active, included free-forever, $1,076
           *
           * This helper standardises all three to the conventional SaaS
           * definition (paying-only, exclude free-forever).
           *
           * Trialing-projected MRR is a separate "potential MRR" metric
           * that should be labelled differently — calculated via
           * calculateProjectedMRR() below if needed.
           */
          export function calculateMRR(
            subs: Array<{ plan: string | null; status: string | null; tenant_id?: string }>,
            tenants?: Map<string, { is_free_forever?: boolean | null }>,
          ): number {
            return subs.reduce((sum, s) => {
              if (s.status !== 'active') return sum;
              if (tenants && s.tenant_id) {
                const t = tenants.get(s.tenant_id);
                if (t?.is_free_forever) return sum;
              }
              if (!s.plan) return sum;
              return sum + (PLAN_PRICE_PER_MONTH[s.plan] ?? 0);
            }, 0);
          }

          /**
           * "Potential" MRR — what the active+trialing book would yield
           * IF every trial converted at its current plan. Conventionally
           * shown alongside MRR with the "If trials convert" label so it
           * can't be confused with paying MRR.
           */
          export function calculateProjectedMRR(
            subs: Array<{ plan: string | null; status: string | null; tenant_id?: string }>,
            tenants?: Map<string, { is_free_forever?: boolean | null }>,
          ): number {
            return subs.reduce((sum, s) => {
              if (s.status !== 'active' && s.status !== 'trialing') return sum;
              if (tenants && s.tenant_id) {
                const t = tenants.get(s.tenant_id);
                if (t?.is_free_forever) return sum;
              }
              if (!s.plan) return sum;
              return sum + (PLAN_PRICE_PER_MONTH[s.plan] ?? 0);
            }, 0);
          }

          const PLAN_ORDER: PlanId[] = ['boutique', 'studio', 'atelier'];

          export function planIncludes(userPlan: PlanId, feature: keyof Omit<PlanFeatures, 'staffLimit'>): boolean {
            return PLAN_FEATURES[userPlan ?? 'boutique']?.[feature] === true;
            }
            export function getMinPlanForFeature(feature: keyof Omit<PlanFeatures, 'staffLimit'>): PlanId | null {
              for (const p of PLAN_ORDER) { if (PLAN_FEATURES[p][feature]) return p; }
                return null;
                }
                export function getUpgradePlan(userPlan: PlanId, feature: keyof Omit<PlanFeatures, 'staffLimit'>): PlanId | null {
                  return planIncludes(userPlan, feature) ? null : getMinPlanForFeature(feature);
                  }
                  export function canAddStaff(userPlan: PlanId, currentCount: number): boolean {
                    const limit = PLAN_FEATURES[userPlan]?.staffLimit;
                      return limit === null || currentCount < limit;
                      }