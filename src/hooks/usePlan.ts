'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PlanId, PlanFeatures } from '@/lib/plans';
import { PLAN_FEATURES, planIncludes, canAddStaff } from '@/lib/plans';

interface UsePlanReturn {
      plan: PlanId;
        features: PlanFeatures;
          canAccess: (feature: keyof Omit<PlanFeatures, 'staffLimit'>) => boolean;
            canAddStaff: (currentCount: number) => boolean;
              staffLimit: number | null;
                loading: boolean;
}

export function usePlan(): UsePlanReturn {
      const [plan, setPlan] = useState<PlanId>('boutique');
        const [loading, setLoading] = useState(true);

          useEffect(() => {
                const supabase = createClient();

                    async function fetchPlan() {
                              const { data: { user } } = await supabase.auth.getUser();
                                    if (!user) { setLoading(false); return; }

                                          const { data } = await supabase
                                                  .from('users')
                                                          .select('tenant_id')
                                                                  .eq('id', user.id)
                                                                          .single();

                                                                                if (!data?.tenant_id) { setLoading(false); return; }

                                                                                      const { data: tenant } = await supabase
                                                                                              .from('tenants')
                                                                                                      .select('plan')
                                                                                                              .eq('id', data.tenant_id)
                                                                                                                      .single();

                                                                                                                            if (tenant?.plan) {
                                                                                                                                        setPlan(tenant.plan as PlanId);
                                                                                                                            }
                                                                                                                                  setLoading(false);
                                                                                                                        }

                                                                                                                            fetchPlan();
                                                                                                                    }, []);

                                                                                                                      const features = PLAN_FEATURES[plan];

                                                                                                                        return {
                                                                                                                                plan,
                                                                                                                                    features,
                                                                                                                                        canAccess: (feature) => planIncludes(plan, feature),
                                                                                                                                            canAddStaff: (currentCount) => canAddStaff(plan, currentCount),
                                                                                                                                                staffLimit: features.staffLimit,
                                                                                                                                                    loading,
                                                                                                                        };
                                                                                                                    }