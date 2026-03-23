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
                      boutique: {
                          staffLimit: 1,
                              multiStore: false,
                                  websiteBuilder: false,
                                      fullAnalytics: false,
                                          aiCopilot: false,
                                              aiFeatures: false,
                                                  aiWebsiteCopy: false,
                                                      customDomain: false,
                                                          whiteLabel: false,
                                                              prioritySupport: false,
                                                                },
                                                                  studio: {
                                                                      staffLimit: 5,
                                                                          multiStore: false,
                                                                              websiteBuilder: true,
                                                                                  fullAnalytics: true,
                                                                                      aiCopilot: true,
                                                                                          aiFeatures: true,
                                                                                              aiWebsiteCopy: false,
                                                                                                  customDomain: false,
                                                                                                      whiteLabel: false,
                                                                                                          prioritySupport: true,
                                                                                                            },
                                                                                                              atelier: {
                                                                                                                  staffLimit: null,
                                                                                                                      multiStore: true,
                                                                                                                          websiteBuilder: true,
                                                                                                                              fullAnalytics: true,
                                                                                                                                  aiCopilot: true,
                                                                                                                                      aiFeatures: true,
                                                                                                                                          aiWebsiteCopy: true,
                                                                                                                                              customDomain: true,
                                                                                                                                                  whiteLabel: true,
                                                                                                                                                      prioritySupport: true,
                                                                                                                                                        },
                                                                                                                                                        };

                                                                                                                                                        export const PLAN_NAMES: Record<PlanId, string> = {
                                                                                                                                                          boutique: 'Boutique',
                                                                                                                                                            studio: 'Studio',
                                                                                                                                                              atelier: 'Atelier',
                                                                                                                                                              };

                                                                                                                                                              export const PLAN_PRICES: Record<PlanId, string> = {
                                                                                                                                                                boutique: '$89/mo',
                                                                                                                                                                  studio: '$179/mo',
                                                                                                                                                                    atelier: '$299/mo',
                                                                                                                                                                    };

                                                                                                                                                                    const PLAN_ORDER: PlanId[] = ['boutique', 'studio', 'atelier'];

                                                                                                                                                                    export function planIncludes(
                                                                                                                                                                      userPlan: PlanId,
                                                                                                                                                                        feature: keyof Omit<PlanFeatures, 'staffLimit'>
                                                                                                                                                                        ): boolean {
                                                                                                                                                                          return PLAN_FEATURES[userPlan ?? 'boutique']?.[feature] === true;
                                                                                                                                                                          }

                                                                                                                                                                          export function getMinPlanForFeature(
                                                                                                                                                                            feature: keyof Omit<PlanFeatures, 'staffLimit'>
                                                                                                                                                                            ): PlanId | null {
                                                                                                                                                                              for (const p of PLAN_ORDER) {
                                                                                                                                                                                  if (PLAN_FEATURES[p][feature]) return p;
                                                                                                                                                                                    }
                                                                                                                                                                                      return null;
                                                                                                                                                                                      }

                                                                                                                                                                                      export function getUpgradePlan(
                                                                                                                                                                                        userPlan: PlanId,
                                                                                                                                                                                          feature: keyof Omit<PlanFeatures, 'staffLimit'>
                                                                                                                                                                                          ): PlanId | null {
                                                                                                                                                                                            return planIncludes(userPlan, feature) ? null : getMinPlanForFeature(feature);
                                                                                                                                                                                            }

                                                                                                                                                                                            export function canAddStaff(userPlan: PlanId, currentCount: number): boolean {
                                                                                                                                                                                              const limit = PLAN_FEATURES[userPlan]?.staffLimit;
                                                                                                                                                                                                return limit === null || currentCount < limit;
                                                                                                                                                                                                }