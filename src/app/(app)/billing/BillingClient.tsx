"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PLAN_FEATURES } from "@/lib/features";
import { toast } from "sonner";

type Plan = "boutique" | "studio" | "group";
type Interval = "monthly" | "annual";

interface Subscription {
  plan: string;
  status: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  grace_period_ends_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_sub_id?: string | null;
  is_free_forever?: boolean;
}

interface BillingInvoice {
  id: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  created: number;
  period_start: number;
  period_end: number;
  number: string | null;
}

interface BillingClientProps {
  subscription: Subscription | null;
  userCount: number;
  inventoryCount?: number;
  customerCount?: number;
  repairCount?: number;
  storageUsedMb?: number;
}

const PLAN_DETAILS: Record<
  Plan,
  {
    name: string;
    monthlyPrice: string;
    annualPrice: string;
    color: string;
    badge?: string;
  }
> = {
  boutique: {
    name: "Boutique",
    monthlyPrice: "AUD $89",
    annualPrice: "AUD $890",
    color: "forest",
  },
  studio: {
    name: "Studio",
    monthlyPrice: "AUD $179",
    annualPrice: "AUD $1,790",
    color: "sage",
    badge: "Most popular",
  },
  group: {
    name: "Group",
    monthlyPrice: "Custom",
    annualPrice: "Custom",
    color: "gold",
    badge: "Enterprise",
  },
};

const FEATURES_TABLE = [
  { label: "Users", boutique: "2", studio: "10", group: "Unlimited" },
  { label: "Business Modes (Workshop/Retail)", boutique: true, studio: true, group: true },
  { label: "Bespoke Production Manager", boutique: true, studio: true, group: true },
  { label: "Storage", boutique: "5GB", studio: "20GB", group: "100GB" },
  { label: "Jewellery Passports", boutique: true, studio: true, group: true },
  { label: "AI Business Copilot", boutique: false, studio: true, group: true },
  { label: "AI Website Builder", boutique: false, studio: false, group: true },
  { label: "Custom Domain", boutique: false, studio: false, group: true },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    trialing: "bg-stone-100 text-stone-700 border border-stone-200",
    active: "bg-green-50 text-green-700 border border-green-200",
    past_due: "bg-red-50 text-red-700 border border-red-200",
    canceled: "bg-stone-100 text-stone-600 border border-stone-200",
    paused: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  };
  const labels: Record<string, string> = {
    trialing: "Free Trial",
    active: "Active",
    past_due: "Payment Due",
    canceled: "Canceled",
    paused: "Paused",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] ?? "bg-stone-100 text-stone-600"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "active"
            ? "bg-green-500"
            : status === "trialing"
            ? "bg-amber-700"
            : status === "past_due"
            ? "bg-red-500"
            : "bg-stone-400"
        }`}
      />
      {labels[status] ?? status}
    </span>
  );
}

function CheckCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm font-medium text-stone-900">{value}</span>;
  }
  if (value) {
    return (
      <svg
        className="w-5 h-5 text-amber-700 mx-auto"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return <span className="text-stone-900/25 text-lg font-light">—</span>;
}

export default function BillingClient({
  subscription,
  userCount,
  inventoryCount = 0,
  customerCount = 0,
  repairCount = 0,
  storageUsedMb = 0,
}: BillingClientProps) {
  const router = useRouter();
  const [selectedInterval, setSelectedInterval] = useState<Interval>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Calculate grace period days remaining
  const graceDaysRemaining = (() => {
    if (!subscription?.grace_period_ends_at) return null;
    const end = new Date(subscription.grace_period_ends_at);
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  useEffect(() => {
    if (subscription?.stripe_customer_id) {
      setInvoicesLoading(true);
      fetch("/api/billing/invoices")
        .then((r) => r.json())
        .then((d: { invoices?: BillingInvoice[] }) => { setInvoices(d.invoices ?? []); })
        .catch(() => {})
        .finally(() => setInvoicesLoading(false));
    }
  }, [subscription?.stripe_customer_id]);

  // Normalize legacy plan keys (basic→boutique, pro→studio, ultimate→group)
  const PLAN_KEY_MAP: Record<string, Plan> = {
    boutique: "boutique", studio: "studio", group: "group",
    basic: "boutique", pro: "studio", ultimate: "group",
  };
  const currentPlan: Plan = PLAN_KEY_MAP[subscription?.plan ?? "boutique"] ?? "boutique";
  const currentPlanDetails = PLAN_DETAILS[currentPlan];
  const maxUsers = PLAN_FEATURES[currentPlan]?.maxUsers;

  async function handleUpgrade(plan: Plan) {
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: selectedInterval }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? "Failed to start checkout");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handleManageBilling() {
    setLoadingPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? "Failed to open billing portal");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoadingPortal(false);
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Status banners */}
      {(subscription?.status === "grace_period" || subscription?.status === "past_due") && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-yellow-800">⚠️ Payment Required</p>
            <p className="text-sm text-yellow-700 mt-0.5">
              {graceDaysRemaining !== null
                ? graceDaysRemaining <= 0
                  ? "Your grace period has ended. Update your payment method immediately."
                  : `${graceDaysRemaining} day${graceDaysRemaining !== 1 ? "s" : ""} remaining to update your payment method before account suspension.`
                : `Payment required${subscription?.grace_period_ends_at ? ` by ${formatDate(subscription.grace_period_ends_at)}` : ""}. Update your payment method to avoid suspension.`}
            </p>
          </div>
          <button onClick={handleManageBilling} disabled={loadingPortal} className="flex-shrink-0 px-4 py-2 bg-yellow-600 text-white text-sm font-semibold rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50">
            Update Payment →
          </button>
        </div>
      )}
      {subscription?.status === "suspended" && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-700">🔴 Account Suspended</p>
            <p className="text-sm text-red-600 mt-0.5">Your account is suspended due to non-payment. Reactivate now to restore access to all features.</p>
          </div>
          <button onClick={handleManageBilling} disabled={loadingPortal} className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
            {loadingPortal ? "Opening…" : "Reactivate Now →"}
          </button>
        </div>
      )}
      {subscription?.status === "cancelled" &&
        subscription?.current_period_end &&
        new Date(subscription.current_period_end) >= new Date() && (
          <div className="bg-orange-50 border border-orange-300 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-800">⚠️ Subscription Cancelled</p>
              <p className="text-sm text-orange-700 mt-0.5">
                Your subscription has been cancelled. You have full access until{" "}
                <strong>{formatDate(subscription.current_period_end)}</strong>, after which your account will be suspended.
              </p>
            </div>
            <button onClick={handleManageBilling} disabled={loadingPortal} className="flex-shrink-0 px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50">
              {loadingPortal ? "Opening…" : "Reactivate →"}
            </button>
          </div>
        )}
      {subscription?.is_free_forever && (
        <div className="bg-amber-700/10 border border-amber-600/20 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-sm font-semibold text-amber-700">Free Membership</p>
            <p className="text-sm text-stone-600 mt-0.5">You have lifetime free access to Nexpura. No billing required.</p>
          </div>
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">
          Billing & Subscription
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Manage your plan and billing details
        </p>
      </div>

      {/* Current plan card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
              Current Plan
            </p>
            <div className="flex items-center gap-3 mb-2">
              <h2
                className={`font-semibold text-2xl font-semibold ${
                  currentPlan === "group"
                    ? "text-[#C9A96E]"
                    : "text-stone-900"
                }`}
              >
                {currentPlanDetails.name}
              </h2>
              <StatusBadge status={subscription?.status ?? "trialing"} />
            </div>
            {subscription?.status === "trialing" && subscription.trial_ends_at && (
              <p className="text-sm text-stone-500">
                Free trial ends{" "}
                <strong className="text-stone-900">
                  {formatDate(subscription.trial_ends_at)}
                </strong>
              </p>
            )}
            {subscription?.status === "active" && subscription.current_period_end && (
              <p className="text-sm text-stone-500">
                Next billing date:{" "}
                <strong className="text-stone-900">
                  {formatDate(subscription.current_period_end)}
                </strong>
              </p>
            )}
          </div>

          {subscription?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              disabled={loadingPortal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-stone-900 text-stone-900 text-sm font-semibold hover:bg-stone-900 hover:text-white transition-all disabled:opacity-60"
            >
              {loadingPortal ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Opening…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Manage Billing
                </>
              )}
            </button>
          )}
        </div>

        {/* Usage meters */}
        <div className="mt-5 pt-5 border-t border-stone-200 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Usage</p>
          {(() => {
            const storageGB = storageUsedMb / 1024;
            const maxStorage = PLAN_FEATURES[currentPlan]?.storageGB ?? 5;
            const storagePercent = Math.min((storageGB / maxStorage) * 100, 100);
            const userMax = maxUsers ?? 999;
            const userPercent = Math.min((userCount / userMax) * 100, 100);
            return (
              <div className="space-y-3">
                {[
                  { label: "Team Members", used: userCount, max: maxUsers === null ? "∞" : maxUsers, pct: maxUsers === null ? 0 : userPercent, warn: maxUsers !== null && userPercent > 80 },
                  { label: "Storage", used: storageGB < 1 ? `${storageUsedMb} MB` : `${storageGB.toFixed(1)} GB`, max: `${maxStorage} GB`, pct: storagePercent, warn: storagePercent > 80 },
                  { label: "Inventory Items", used: inventoryCount, max: "Unlimited", pct: 0, warn: false },
                  { label: "Customers", used: customerCount, max: "Unlimited", pct: 0, warn: false },
                ].map(({ label, used, max, pct, warn }) => (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-stone-500">{label}</span>
                      <span className={`text-xs font-medium ${warn ? "text-amber-600" : "text-stone-700"}`}>
                        {used} / {max}
                      </span>
                    </div>
                    {pct > 0 && (
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${warn ? "bg-amber-400" : "bg-amber-700"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Upgrade section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h2 className="font-semibold text-xl font-semibold text-stone-900">
              Plans
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Upgrade or downgrade anytime
            </p>
          </div>

          {/* Interval toggle */}
          <div className="flex items-center bg-stone-50 rounded-xl p-1 border border-stone-200 w-fit">
            <button
              onClick={() => setSelectedInterval("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                selectedInterval === "monthly"
                  ? "bg-white shadow-sm text-stone-900"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedInterval("annual")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                selectedInterval === "annual"
                  ? "bg-white shadow-sm text-stone-900"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Annual
              <span className="text-xs bg-stone-100 text-amber-700 px-1.5 py-0.5 rounded-md font-semibold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(["boutique", "studio", "group"] as Plan[]).map((plan) => {
            const details = PLAN_DETAILS[plan];
            const isCurrent = plan === currentPlan;
            const isGold = plan === "group";
            const isSage = plan === "studio";

            return (
              <div
                key={plan}
                className={`relative bg-white rounded-2xl border-2 transition-all p-6 ${
                  isCurrent
                    ? isGold
                      ? "border-[#C9A96E] shadow-md"
                      : "border-amber-600 shadow-md"
                    : "border-stone-200 hover:border-stone-200 hover:shadow-sm"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm ${
                        isGold ? "bg-[#C9A96E]" : "bg-amber-700"
                      }`}
                    >
                      Current plan
                    </span>
                  </div>
                )}

                <h3
                  className={`font-semibold text-xl font-semibold mb-1 ${
                    isGold ? "text-[#C9A96E]" : "text-stone-900"
                  }`}
                >
                  {details.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-bold text-stone-900">
                    {selectedInterval === "monthly"
                      ? details.monthlyPrice
                      : details.annualPrice}
                  </span>
                  <span className="text-stone-500 text-sm">
                    /{selectedInterval === "monthly" ? "mo" : "yr"}
                  </span>
                </div>

                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={isCurrent || loadingPlan !== null}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    isCurrent
                      ? "bg-stone-50 text-stone-400 cursor-default border border-stone-200"
                      : isGold
                      ? "bg-[#C9A96E] hover:bg-[#C9A96E]/90 text-white shadow-sm"
                      : isSage
                      ? "bg-amber-700 hover:bg-amber-800 text-white shadow-sm"
                      : "bg-white border-2 border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white"
                  } disabled:opacity-60`}
                >
                  {loadingPlan === plan ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading…
                    </span>
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : plan === "boutique" ? (
                    "Downgrade"
                  ) : (
                    "Upgrade"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200">
          <h3 className="font-semibold text-lg font-semibold text-stone-900">
            Feature Comparison
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide w-1/2">
                  Feature
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Boutique
                  <br />
                  <span className="text-stone-900 font-bold normal-case text-sm">$89</span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Studio
                  <br />
                  <span className="text-stone-900 font-bold normal-case text-sm">$179</span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#C9A96E] uppercase tracking-wide">
                  Group
                  <br />
                  <span className="text-stone-900 font-bold normal-case text-sm">Custom</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES_TABLE.map((row, i) => (
                <tr
                  key={row.label}
                  className={`border-b border-stone-200 last:border-0 ${
                    i % 2 === 0 ? "bg-white" : "bg-stone-50/50"
                  }`}
                >
                  <td className="px-6 py-3.5 text-sm text-stone-900 font-medium">
                    {row.label}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <CheckCell value={row.boutique} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <CheckCell value={row.studio} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <CheckCell value={row.group} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Billing History */}
      {subscription?.stripe_customer_id && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-xl font-semibold text-stone-900">Billing History</h2>
            <button
              onClick={handleManageBilling}
              disabled={loadingPortal}
              className="text-xs text-amber-700 hover:underline"
            >
              Manage payment method →
            </button>
          </div>
          {invoicesLoading ? (
            <p className="text-sm text-stone-400">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-stone-400">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left pb-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Invoice</th>
                    <th className="text-left pb-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Date</th>
                    <th className="text-left pb-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left pb-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Status</th>
                    <th className="text-right pb-3 text-xs font-medium text-stone-500 uppercase tracking-wide">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 font-mono text-xs text-stone-500">{inv.number || inv.id.slice(-8)}</td>
                      <td className="py-3 text-stone-600">
                        {new Date(inv.created * 1000).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 font-semibold text-stone-900">
                        {new Intl.NumberFormat("en-AU", { style: "currency", currency: inv.currency || "AUD" }).format(inv.amount_paid || inv.amount_due)}
                      </td>
                      <td className="py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                          inv.status === "paid" ? "bg-green-50 text-green-700" :
                          inv.status === "open" ? "bg-amber-50 text-amber-700" :
                          "bg-stone-100 text-stone-500"
                        }`}>
                          {inv.status || "—"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {inv.invoice_pdf && (
                          <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 hover:underline">
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cancel subscription */}
      {subscription?.stripe_sub_id && subscription.status === "active" && !subscription.is_free_forever && (
        <div className="text-center">
          {showCancelConfirm ? (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 max-w-md mx-auto text-left">
              <p className="text-sm font-semibold text-stone-900 mb-1">Cancel your subscription?</p>
              <p className="text-sm text-stone-500 mb-4">You&apos;ll keep access until the end of your current billing period. All your data will be preserved.</p>
              <div className="mb-4">
                <label className="block text-xs font-medium text-stone-500 mb-1">Why are you cancelling? <span className="text-stone-400">(optional)</span></label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-600"
                >
                  <option value="">Choose a reason…</option>
                  <option value="too_expensive">Too expensive</option>
                  <option value="missing_features">Missing features I need</option>
                  <option value="not_using">Not using it enough</option>
                  <option value="switching_competitor">Switching to a competitor</option>
                  <option value="closing_business">Closing my business</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCancelConfirm(false)} className="flex-1 px-4 py-2.5 border border-stone-200 text-stone-700 text-sm rounded-lg hover:bg-stone-50 font-medium">
                  Keep Subscription
                </button>
                <button onClick={handleManageBilling} className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">
                  Cancel via Portal
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCancelConfirm(true)} className="text-sm text-stone-400 hover:text-stone-600 underline">
              Cancel subscription
            </button>
          )}
        </div>
      )}

      {/* Contact note */}
      <p className="text-center text-sm text-stone-400">
        Need a custom plan for your business?{" "}
        <a href="mailto:hello@nexpura.com" className="text-amber-700 hover:underline">
          Contact us
        </a>
      </p>
    </div>
  );
}
