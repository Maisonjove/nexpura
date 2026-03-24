"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STRIPE_PRICES } from "@/lib/stripe/prices";

type Plan = "boutique" | "studio" | "atelier";

interface BillingClientProps {
  tenantId: string;
  currentPlan: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

const PLANS = [
  {
    id: "boutique",
    name: "Boutique",
    monthlyPrice: 89,
    description: "For independent jewellers.",
    features: ["1 User", "1 Store", "Unlimited Invoices", "Core Operations", "Jewellery Passports"],
  },
  {
    id: "studio",
    name: "Studio",
    monthlyPrice: 179,
    description: "For growing jewellery studios.",
    features: ["Up to 5 Users", "Up to 3 Stores", "Advanced Analytics", "Website Builder", "Connect Website", "Migration Hub"],
    popular: true,
  },
  {
    id: "atelier",
    name: "Atelier",
    monthlyPrice: 299,
    description: "For high-volume jewellery groups.",
    features: ["Unlimited Users", "Unlimited Stores", "All Features Included", "Priority Support", "Custom Domain", "White-glove Migration"],
  },
];

// Calculate annual price (20% off): monthly × 12 × 0.8
function getDisplayPrice(monthlyPrice: number, interval: "monthly" | "annual"): string {
  if (interval === "monthly") {
    return `$${monthlyPrice}`;
  }
  const annualPrice = Math.round(monthlyPrice * 12 * 0.8);
  return `$${annualPrice.toLocaleString()}`;
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
}: BillingClientProps) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    try {
      const priceId = (STRIPE_PRICES as any)[planId][interval];
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, plan: planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
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
              {isTrial && trialEndsAt ? new Date(trialEndsAt).toLocaleDateString("en-AU") :
               isActive && currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString("en-AU") : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Toggle */}
      <div className="flex justify-center">
        <div className="bg-stone-100 p-1 rounded-xl inline-flex items-center gap-1">
          <button
            onClick={() => setInterval("monthly")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              interval === "monthly" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("annual")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              interval === "annual" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Annual
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-3xl border-2 p-8 flex flex-col transition-all ${
              plan.id === currentPlan ? "border-amber-600 ring-4 ring-amber-600/5" : "border-stone-100 hover:border-stone-200 shadow-sm"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                Most Popular
              </div>
            )}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-stone-900">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-stone-900">{getDisplayPrice(plan.monthlyPrice, interval)}</span>
                <span className="text-stone-500 text-sm font-medium">/{interval === "monthly" ? "mo" : "yr"}</span>
              </div>
              {interval === "annual" && (
                <p className="text-xs text-emerald-600 mt-1">
                  Save ${Math.round(plan.monthlyPrice * 12 * 0.2).toLocaleString()}/year
                </p>
              )}
              <p className="mt-4 text-sm text-stone-500 leading-relaxed">{plan.description}</p>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              {plan.features.map((feat) => (
                <li key={feat} className="flex items-center gap-3 text-sm text-stone-600">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {feat}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={loading === plan.id || plan.id === currentPlan}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                plan.id === currentPlan
                  ? "bg-stone-50 text-stone-400 cursor-default"
                  : "bg-[#071A0D] text-white hover:bg-stone-800 shadow-md shadow-stone-900/10 active:scale-[0.98]"
              }`}
            >
              {loading === plan.id ? "Processing..." : plan.id === currentPlan ? "Current Plan" : `Upgrade to ${plan.name}`}
            </button>
          </div>
        ))}
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
