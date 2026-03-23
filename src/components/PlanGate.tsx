'use client';

import { usePlan } from '@/hooks/usePlan';
import type { PlanFeatures } from '@/lib/plans';
import { PLAN_NAMES, PLAN_PRICES, getUpgradePlan } from '@/lib/plans';
import Link from 'next/link';

interface PlanGateProps {
      feature: keyof Omit<PlanFeatures, 'staffLimit'>;
        children: React.ReactNode;
          fallback?: React.ReactNode;
}

export function PlanGate({ feature, children, fallback }: PlanGateProps) {
      const { canAccess, plan, loading } = usePlan();
        if (loading) return null;
          if (canAccess(feature)) return <>{children}</>;

            const upgradePlan = getUpgradePlan(plan, feature);

              if (fallback) return <>{fallback}</>;

                return (
                        <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-muted/50">
                                  <h3 className="text-lg font-semibold mb-2">Upgrade Required</h3>
                                        <p className="text-muted-foreground mb-4">
                                                    This feature requires the {upgradePlan ? PLAN_NAMES[upgradePlan] : 'higher'} plan
                                                            {upgradePlan ? ` (${PLAN_PRICES[upgradePlan]})` : ''}.
                                                                  </p>
                                                                        <Link href="/settings/billing" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Upgrade Plan</Link>
                                                                            </div>
                );
            }