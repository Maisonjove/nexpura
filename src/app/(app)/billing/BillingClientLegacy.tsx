"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  /** Tenant's IANA timezone. Sibling of L-05 fix (#165) — same
   *  rationale: trial-end / next-billing dates pinned to the tenant's
   *  TZ so they match Stripe's billing cycle at the day boundary.
   *  Null falls back to the user's browser TZ (legacy behaviour). */
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

  // L-05 sibling — see BillingClient.tsx for the rationale.
  const dateFmt: Intl.DateTimeFormatOptions = {
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
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-stone-900">Subscription & Plan</h1>
        <p className="text-stone-500 max-w-2xl mx-auto">
          Manage your Nexpura plan and billing details. All plans include core jewellery operations.
        </p>

        {/* Status card */}
        <div className="inline-flex items-center gap-6 bg-white border border-stone-200 px-6 py-3 rounded-2xl shadow-sm mt-4">
          <div className="text-left">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Current Plan</p>
            <p className="text-sm font-bold text-amber-700 capitalize">{currentPlan}</p>
          </div>
          <div className="w-px h-8 bg-stone-100" />
          <div className="text-left">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Status</p>
            <p className="text-sm font-semibold text-stone-900">
              {isTrial ? "Free Trial" : isActive ? "Active" : "No active subscription"}
            </p>
          </div>
          <div className="w-px h-8 bg-stone-100" />
          <div className="text-left">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              {isTrial ? "Trial Ends" : "Next Billing"}
            </p>
            <p className="text-sm font-semibold text-stone-900">
              {isTrial && trialEndsAt ? formatDate(trialEndsAt) :
               isActive && currentPeriodEnd ? formatDate(currentPeriodEnd) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Plan Cards — monthly only per Phase 1.5 post-audit; annual
           toggle removed. Prices shown in tenant's billing currency. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PLAN_CARD_DESCRIPTORS.map((descriptor) => {
          const masterPlan = MASTER_PLANS.find((p) => p.id === descriptor.id)!;
          const planName = masterPlan.name;
          const { display } = getDisplayPrice(descriptor.id, currency);
          return (
            <div
              key={descriptor.id}
              className={`relative bg-white rounded-3xl border-2 p-8 flex flex-col transition-all ${
                descriptor.id === currentPlan ? "border-amber-600 ring-4 ring-amber-600/5" : "border-stone-100 hover:border-stone-200 shadow-sm"
              }`}
            >
              {descriptor.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-stone-900">{planName}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-stone-900">{display}</span>
                  <span className="text-stone-500 text-sm font-medium">/mo</span>
                </div>
                <p className="mt-4 text-sm text-stone-500 leading-relaxed">{descriptor.description}</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {descriptor.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-3 text-sm text-stone-600">
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(descriptor.id)}
                disabled={loading === descriptor.id || descriptor.id === currentPlan}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  descriptor.id === currentPlan
                    ? "bg-stone-50 text-stone-400 cursor-default"
                    : "bg-[#071A0D] text-white hover:bg-stone-800 shadow-md shadow-stone-900/10 active:scale-[0.98]"
                }`}
              >
                {loading === descriptor.id ? "Processing..." : descriptor.id === currentPlan ? "Current Plan" : `Upgrade to ${planName}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-8 py-6 bg-stone-50 border-b border-stone-200">
          <h2 className="text-lg font-bold text-stone-900">Feature Comparison</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="px-8 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Feature</th>
              <th className="px-8 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Boutique</th>
              <th className="px-8 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Studio</th>
              <th className="px-8 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center text-amber-700">Atelier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {COMPARISON.map((row) => (
              <tr key={row.label} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-8 py-4 text-sm font-medium text-stone-700">{row.label}</td>
                <td className="px-8 py-4 text-sm text-stone-500 text-center">
                  {typeof row.boutique === "boolean" ? (row.boutique ? "✅" : "—") : row.boutique}
                </td>
                <td className="px-8 py-4 text-sm text-stone-500 text-center">
                  {typeof row.studio === "boolean" ? (row.studio ? "✅" : "—") : row.studio}
                </td>
                <td className="px-8 py-4 text-sm text-stone-900 font-semibold text-center">
                  {typeof row.atelier === "boolean" ? (row.atelier ? "✅" : "—") : row.atelier}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
