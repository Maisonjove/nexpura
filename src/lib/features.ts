export const PLAN_FEATURES = {
  basic: {
    maxUsers: 1 as number | null,
    storageGB: 5,
    aiCopilot: false,
    aiWebsite: false,
    customDomain: false,
  },
  pro: {
    maxUsers: 5 as number | null,
    storageGB: 20,
    aiCopilot: true,
    aiWebsite: false,
    customDomain: false,
  },
  ultimate: {
    maxUsers: null as number | null, // unlimited
    storageGB: 100,
    aiCopilot: true,
    aiWebsite: true,
    customDomain: true,
  },
}

export type PlanName = keyof typeof PLAN_FEATURES
export type PlanFeatureKey = keyof typeof PLAN_FEATURES.basic

export function canUseFeature(plan: string, feature: PlanFeatureKey): boolean {
  const planFeatures = PLAN_FEATURES[plan as PlanName]
  if (!planFeatures) return false
  const value = planFeatures[feature]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  return value !== null // null = unlimited = true
}

export function getMaxUsers(plan: string): number | null {
  return PLAN_FEATURES[plan as PlanName]?.maxUsers ?? 1
}

export function getStorageGB(plan: string): number {
  return PLAN_FEATURES[plan as PlanName]?.storageGB ?? 5
}
