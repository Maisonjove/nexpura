/**
 * Nexpura Plan Entitlements
 *
 * Plans:  boutique | studio | atelier — pricing in src/data/pricing.ts (4 currencies)
 * Legacy: basic=boutique, pro=studio, group=atelier, ultimate=atelier
 * 
 * Feature breakdown:
 * - Boutique: Basic features (inventory, POS, customers, 1 user)
 * - Studio: + Repairs, Bespoke, Reports, 3 users (legacy: up to 5)
 * - Atelier: + Everything, unlimited users, white-label, API access
 */

export const PLAN_FEATURES = {
  boutique: {
    maxUsers: 1 as number | null,        // 1 user
    maxLocations: 1 as number | null,    // 1 store
    storageGB: 5,
    // Core features (all plans)
    pos: true,
    inventory: true,
    customers: true,
    invoicing: true,
    passports: true,
    // Workshop features (Studio+)
    repairs: false,                      // Boutique: no repairs module
    bespoke: false,                      // Boutique: no bespoke module
    reports: false,                      // Boutique: basic dashboard only
    // Advanced features
    aiCopilot: true,                     // included in all plans
    aiWebsite: false,
    websiteBuilder: false,               // Boutique: no website builder
    websiteConnect: false,               // Boutique: no connect existing website
    analytics: false,                    // Boutique: basic dashboard only
    customDomain: false,
    whiteLabel: false,
    apiAccess: false,
  },
  studio: {
    maxUsers: 3 as number | null,        // up to 3 users (was 5)
    maxLocations: 3 as number | null,    // up to 3 stores
    storageGB: 20,
    // Core features (all plans)
    pos: true,
    inventory: true,
    customers: true,
    invoicing: true,
    passports: true,
    // Workshop features (Studio+)
    repairs: true,                       // Studio: repairs enabled
    bespoke: true,                       // Studio: bespoke enabled
    reports: true,                       // Studio: full reports
    // Advanced features
    aiCopilot: true,
    aiWebsite: false,
    websiteBuilder: true,                // Studio: website builder included
    websiteConnect: true,                // Studio: connect existing website included
    analytics: true,                     // Studio: full analytics
    customDomain: false,
    whiteLabel: false,
    apiAccess: false,
  },
  atelier: {
    maxUsers: null as number | null,     // unlimited
    maxLocations: null as number | null, // unlimited
    storageGB: 100,
    // Core features (all plans)
    pos: true,
    inventory: true,
    customers: true,
    invoicing: true,
    passports: true,
    // Workshop features (all enabled)
    repairs: true,
    bespoke: true,
    reports: true,
    // Advanced features
    aiCopilot: true,
    aiWebsite: true,
    websiteBuilder: true,               // Atelier: all features
    websiteConnect: true,
    analytics: true,
    customDomain: true,
    whiteLabel: true,                   // Atelier: white-label options
    apiAccess: true,                    // Atelier: API access
  },

  // ─── Legacy aliases — DB rows written before plan key migration ────────────
  basic:    { maxUsers: 1 as number | null, maxLocations: 1 as number | null, storageGB: 5,   pos: true, inventory: true, customers: true, invoicing: true, passports: true, repairs: false, bespoke: false, reports: false, aiCopilot: true,  aiWebsite: false, websiteBuilder: false, websiteConnect: false, analytics: false, customDomain: false, whiteLabel: false, apiAccess: false },
  pro:      { maxUsers: 3 as number | null, maxLocations: 3 as number | null, storageGB: 20,  pos: true, inventory: true, customers: true, invoicing: true, passports: true, repairs: true,  bespoke: true,  reports: true,  aiCopilot: true,  aiWebsite: false, websiteBuilder: true,  websiteConnect: true,  analytics: true,  customDomain: false, whiteLabel: false, apiAccess: false },
  group:    { maxUsers: null as number | null, maxLocations: null as number | null, storageGB: 100, pos: true, inventory: true, customers: true, invoicing: true, passports: true, repairs: true, bespoke: true, reports: true, aiCopilot: true, aiWebsite: true, websiteBuilder: true, websiteConnect: true, analytics: true, customDomain: true, whiteLabel: true, apiAccess: true },
  ultimate: { maxUsers: null as number | null, maxLocations: null as number | null, storageGB: 100, pos: true, inventory: true, customers: true, invoicing: true, passports: true, repairs: true, bespoke: true, reports: true, aiCopilot: true, aiWebsite: true, websiteBuilder: true, websiteConnect: true, analytics: true, customDomain: true, whiteLabel: true, apiAccess: true },
} as const;

export type PlanName = keyof typeof PLAN_FEATURES;
export type PlanFeatureKey = keyof typeof PLAN_FEATURES.boutique;

/** Canonical plan key — normalises legacy aliases */
export function canonicalPlan(plan: string): "boutique" | "studio" | "atelier" {
  if (plan === "basic") return "boutique";
  if (plan === "pro") return "studio";
  if (plan === "group" || plan === "ultimate") return "atelier";
  if (plan === "boutique" || plan === "studio" || plan === "atelier") return plan;
  return "boutique"; // safe default
}

export function canUseFeature(plan: string, feature: PlanFeatureKey): boolean {
  const p = PLAN_FEATURES[plan as PlanName];
  if (!p) return false;
  const value = p[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return value !== null; // null = unlimited = allowed
}

export function getMaxUsers(plan: string): number | null {
  const p = canonicalPlan(plan);
  return (PLAN_FEATURES[p] as any).maxUsers;
}

export function getMaxLocations(plan: string): number | null {
  const p = canonicalPlan(plan);
  return (PLAN_FEATURES[p] as any).maxLocations;
}

export function getStorageGB(plan: string): number {
  const p = canonicalPlan(plan);
  return (PLAN_FEATURES[p] as any).storageGB ?? 5;
}

/** Human-readable plan display name */
export function planDisplayName(plan: string): string {
  const map: Record<string, string> = {
    boutique: "Boutique", studio: "Studio", atelier: "Atelier",
    basic: "Boutique", pro: "Studio", group: "Atelier", ultimate: "Atelier",
  };
  return map[plan] ?? "Boutique";
}
