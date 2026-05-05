"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@heroicons/react/24/outline";
import { PLANS as MASTER_PLANS, type CurrencyCode } from "@/data/pricing";
import logger from "@/lib/logger";

interface BillingClientProps {
  tenantId: string;
  currentPlan: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  subdomain: string;
  email: string;
  /** Tenant's billing currency — controls which price the plan card
   *  displays and which price ID is used at checkout. */
  currency: CurrencyCode;
  /** Tenant's IANA timezone (e.g. "Australia/Sydney"). Pins the
   *  trial-end + next-billing date display so a tenant in a different
   *  TZ from the staff member viewing the page sees the same date as
   *  Stripe's billing cycle. Null falls back to the user's browser TZ
   *  (the pre-fix behaviour). L-05 audit, 2026-05-05. */
  tenantTimezone: string | null;
}

// Map the marketing PLANS (full feature copy + multi-currency) to the
// terser plan-card shape the /billing UI uses. Phase 1.5 post-audit
// removed the standalone `monthlyPrice: 89/179/299` table here in
// favour of canonical lookup against src/data/pricing.ts.
const PLAN_CARD_DESCRIPTORS: Array<{
  id: "boutique" | "studio" | "atelier";
  description: string;
  features: string[];
  popular?: boolean;
}> = [
  {
    id: "boutique",
    description: "For independent jewellers.",
    features: ["1 User", "1 Store", "Unlimited Invoices", "Core Operations", "Jewellery Passports"],
  },
  {
    id: "studio",
    description: "For growing jewellery studios.",
    features: ["Up to 5 Users", "Up to 3 Stores", "Advanced Analytics", "Website Builder", "Connect Website", "Migration Hub"],
    popular: true,
  },
  {
    id: "atelier",
    description: "For high-volume jewellery groups.",
    features: ["Unlimited Users", "Unlimited Stores", "All Features Included", "Priority Support", "Custom Domain", "White-glove Migration"],
  },
];

function getDisplayPrice(planId: string, currency: CurrencyCode): { display: string; symbol: string } {
  const planRow = MASTER_PLANS.find((p) => p.id === planId);
  if (!planRow) return { display: "—", symbol: "$" };
  const price = planRow.pricing[currency];
  return { display: `${price.symbol}${price.amount}`, symbol: price.symbol };
}

const COMPARISON = [
  { label: "Users", boutique: "1", studio: "5", atelier: "Unlimited" },
  { label: "Stores / Locations", boutique: "1", studio: "3", atelier: "Unlimited" },
  { label: "AI Business Copilot", boutique: true, studio: true, atelier: true },
  { label: "Core operations (repairs, bespoke, POS, inventory)", boutique: true, studio: true, atelier: true },
  { label: "Jewellery Passports", boutique: true, studio: true, atelier: true },
  { label: "Website Builder", boutique: false, studio: true, atelier: true },
  { label: "Connect Existing Website", boutique: false, studio: true, atelier: true },
  { label: "Advanced Analytics", boutique: false, studio: true, atelier: true },
];

export default function BillingClient({
  currentPlan,
  subscriptionStatus,
  trialEndsAt,
  currentPeriodEnd,
  subdomain,
  email,
  currency,
  tenantTimezone,
}: BillingClientProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  // L-05: pre-fix used toLocaleDateString("en-AU") with no timeZone
  // option, defaulting to the user's browser TZ. For tenants whose
  // business operates in a different TZ from the staff member viewing
  // the page, that meant the displayed date could disagree with what
  // Stripe actually charges (Stripe operates on the trial_ends_at
  // timestamp). At the day boundary, the user could see "Trial ends
  // 11 Aug" while the tenant TZ said it's actually 12 Aug — confusing,
  // and a recurring source of "why didn't it charge yet?" tickets.
  const dateFmt: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(tenantTimezone ? { timeZone: tenantTimezone } : {}),
  };
  const formatDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString("en-AU", dateFmt) : "—";

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    try {
      // Phase 1.5 post-audit: monthly-only path. The new /api/billing/checkout
      // resolves price_id from PLANS keyed by tenant.currency on the server;
      // the client just passes plan name.
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(null);
    }
  }

  const isTrial = subscriptionStatus === "trialing";
  const isActive = subscriptionStatus === "active";

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12 px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
      <div className="max-w-[1200px] mx-auto">
        {/* Page Header */}
        <div className="mb-16">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-4">
            Account
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-stone-900 leading-tight">
            Billing
          </h1>
          <p className="text-stone-500 mt-4 max-w-xl text-base leading-relaxed">
            Your subscription, plans, and payment history.
          </p>
        </div>

        {/* Status card */}
        <div className="bg-white border border-stone-200 rounded-2xl px-6 py-6 sm:px-8 sm:py-7 mb-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x sm:divide-stone-200">
            <div className="sm:pr-8">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Current Plan
              </p>
              <p className="font-serif text-2xl text-stone-900 capitalize">
                {currentPlan}
              </p>
            </div>
            <div className="sm:px-8">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Status
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive ? "bg-emerald-500" : isTrial ? "bg-amber-500" : "bg-stone-300"
                  }`}
                />
                <p className="text-base font-medium text-stone-900">
                  {isTrial ? "Free Trial" : isActive ? "Active" : "No subscription"}
                </p>
              </div>
            </div>
            <div className="sm:pl-8">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                {isTrial ? "Trial Ends" : "Next Billing"}
              </p>
              <p className="text-base font-medium text-stone-900">
                {isTrial && trialEndsAt
                  ? formatDate(trialEndsAt)
                  : isActive && currentPeriodEnd
                  ? formatDate(currentPeriodEnd)
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Plans Section Heading */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            Plans
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl text-stone-900 leading-tight">
            Choose your plan
          </h2>
          <p className="text-stone-500 max-w-xl mt-3 text-base leading-relaxed">
            All plans include core jewellery operations. Upgrade anytime; downgrade at the end of your billing cycle.
          </p>
        </div>

        {/* Plan Cards — monthly only per Phase 1.5 post-audit; annual
             toggle removed. Prices shown in tenant's billing currency. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {PLAN_CARD_DESCRIPTORS.map((descriptor) => {
            const masterPlan = MASTER_PLANS.find((p) => p.id === descriptor.id)!;
            const planName = masterPlan.name;
            const { display } = getDisplayPrice(descriptor.id, currency);
            const isCurrent = descriptor.id === currentPlan;
            const isFeatured = descriptor.popular;

            return (
              <div
                key={descriptor.id}
                className={`relative rounded-2xl p-8 flex flex-col transition-all duration-400 ${
                  isFeatured
                    ? "bg-white border border-nexpura-bronze shadow-[0_8px_32px_rgba(139,115,85,0.10)]"
                    : "bg-white border border-stone-200 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
                }`}
              >
                {descriptor.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-nexpura-bronze text-white text-[0.6875rem] tracking-[0.15em] uppercase px-3 py-1 rounded-full shadow-sm">
                    Most Popular
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute top-6 right-6">
                    <span className="nx-badge-success">Current</span>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="font-serif text-2xl text-stone-900">{planName}</h3>
                  <p className="mt-2 text-sm text-stone-500 leading-relaxed">
                    {descriptor.description}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="font-serif text-5xl text-stone-900 leading-none">
                      {display}
                    </span>
                    <span className="text-stone-500 text-sm">/ month</span>
                  </div>
                </div>

                <div className="h-px bg-stone-200 mb-6" />

                <ul className="space-y-3.5 mb-10 flex-1">
                  {descriptor.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-stone-700">
                      <CheckIcon
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          isFeatured ? "text-nexpura-bronze" : "text-stone-400"
                        }`}
                        strokeWidth={2.5}
                      />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(descriptor.id)}
                  disabled={loading === descriptor.id || isCurrent}
                  className={`w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-sm font-medium tracking-[0.01em] transition-all duration-200 ${
                    isCurrent
                      ? "bg-stone-100 text-stone-400 cursor-default border border-stone-200"
                      : isFeatured
                      ? "bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] text-white shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] hover:from-[#444] hover:to-[#222] active:scale-[0.99] disabled:opacity-60"
                      : "bg-white text-stone-900 border border-stone-300 hover:bg-stone-50 hover:border-stone-400 active:scale-[0.99] disabled:opacity-60"
                  }`}
                >
                  {loading === descriptor.id
                    ? "Processing…"
                    : isCurrent
                    ? "Current Plan"
                    : `Upgrade to ${planName}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            Compare
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl text-stone-900 leading-tight">
            Feature comparison
          </h2>
          <p className="text-stone-500 max-w-xl mt-3 text-base leading-relaxed">
            See what&apos;s included at every tier.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="px-6 sm:px-8 py-5 text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury">
                  Feature
                </th>
                <th className="px-6 sm:px-8 py-5 text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury text-center">
                  Boutique
                </th>
                <th className="px-6 sm:px-8 py-5 text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury text-center">
                  Studio
                </th>
                <th className="px-6 sm:px-8 py-5 text-[0.6875rem] font-semibold text-nexpura-bronze uppercase tracking-luxury text-center">
                  Atelier
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {COMPARISON.map((row) => (
                <tr key={row.label} className="hover:bg-stone-50/50 transition-colors duration-200">
                  <td className="px-6 sm:px-8 py-4 text-sm font-medium text-stone-700">
                    {row.label}
                  </td>
                  <td className="px-6 sm:px-8 py-4 text-sm text-stone-600 text-center">
                    {typeof row.boutique === "boolean" ? (
                      row.boutique ? (
                        <CheckIcon className="w-4 h-4 text-stone-700 mx-auto" strokeWidth={2.5} />
                      ) : (
                        <span className="text-stone-300">—</span>
                      )
                    ) : (
                      row.boutique
                    )}
                  </td>
                  <td className="px-6 sm:px-8 py-4 text-sm text-stone-600 text-center">
                    {typeof row.studio === "boolean" ? (
                      row.studio ? (
                        <CheckIcon className="w-4 h-4 text-stone-700 mx-auto" strokeWidth={2.5} />
                      ) : (
                        <span className="text-stone-300">—</span>
                      )
                    ) : (
                      row.studio
                    )}
                  </td>
                  <td className="px-6 sm:px-8 py-4 text-sm font-medium text-stone-900 text-center">
                    {typeof row.atelier === "boolean" ? (
                      row.atelier ? (
                        <CheckIcon className="w-4 h-4 text-nexpura-bronze mx-auto" strokeWidth={2.5} />
                      ) : (
                        <span className="text-stone-300">—</span>
                      )
                    ) : (
                      row.atelier
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer help text */}
        <p className="text-center text-sm text-stone-500 mt-16">
          Questions about billing? Contact{" "}
          <a
            href="mailto:support@nexpura.com"
            className="text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
          >
            support@nexpura.com
          </a>
        </p>
      </div>
    </div>
  );
}
