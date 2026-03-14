"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PLAN_FEATURES } from "@/lib/features";

type Plan = "basic" | "pro" | "ultimate";
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
  basic: {
    name: "Basic",
    monthlyPrice: "AUD $49",
    annualPrice: "AUD $470",
    color: "forest",
  },
  pro: {
    name: "Pro",
    monthlyPrice: "AUD $99",
    annualPrice: "AUD $950",
    color: "sage",
    badge: "Most popular",
  },
  ultimate: {
    name: "Ultimate",
    monthlyPrice: "AUD $199",
    annualPrice: "AUD $1,910",
    color: "gold",
    badge: "Most powerful",
  },
};

const FEATURES_TABLE = [
  { label: "Users", basic: "1", pro: "5", ultimate: "Unlimited" },
  { label: "Storage", basic: "5GB", pro: "20GB", ultimate: "100GB" },
  { label: "Jewellery Passports", basic: true, pro: true, ultimate: true },
  { label: "AI Business Copilot", basic: false, pro: true, ultimate: true },
  { label: "AI Website Builder", basic: false, pro: false, ultimate: true },
  { label: "Custom Domain", basic: false, pro: false, ultimate: true },
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
            ? "bg-[#8B7355]"
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
        className="w-5 h-5 text-[#8B7355] mx-auto"
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
}: BillingClientProps) {
  const router = useRouter();
  const [selectedInterval, setSelectedInterval] = useState<Interval>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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

  const currentPlan = (subscription?.plan ?? "basic") as Plan;
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
        alert(data.error ?? "Failed to start checkout");
      }
    } catch {
      alert("Something went wrong. Please try again.");
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
        alert(data.error ?? "Failed to open billing portal");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoadingPortal(false);
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Status banners */}
      {subscription?.status === "grace_period" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-700">⚠️ Payment Required</p>
            <p className="text-sm text-red-600 mt-0.5">
              Payment required{subscription.grace_period_ends_at ? ` by ${formatDate(subscription.grace_period_ends_at)}` : ""}. Update your payment method to avoid suspension.
            </p>
          </div>
          <button onClick={handleManageBilling} disabled={loadingPortal} className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
            Update Payment →
          </button>
        </div>
      )}
      {subscription?.status === "suspended" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-700">🔴 Account Suspended</p>
            <p className="text-sm text-red-600 mt-0.5">Your account is suspended due to non-payment. Update your payment method to reactivate.</p>
          </div>
          <button onClick={handleManageBilling} disabled={loadingPortal} className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
            Reactivate →
          </button>
        </div>
      )}
      {subscription?.is_free_forever && (
        <div className="bg-[#8B7355]/10 border border-[#8B7355]/20 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-[#8B7355]">🎁 Free Account</p>
          <p className="text-sm text-stone-600 mt-0.5">You have lifetime free access to Nexpura. No billing required.</p>
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
                  currentPlan === "ultimate"
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

        {/* Usage stats */}
        <div className="mt-5 pt-5 border-t border-stone-200 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-xs text-stone-500 font-medium mb-1">Users</p>
            <p className="text-lg font-bold text-stone-900">
              {userCount}
              <span className="text-stone-400 font-normal text-sm">
                {" "}
                / {maxUsers === null ? "∞" : maxUsers}
              </span>
            </p>
          </div>
          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-xs text-stone-500 font-medium mb-1">Storage</p>
            <p className="text-lg font-bold text-stone-900">
              0 GB
              <span className="text-stone-400 font-normal text-sm">
                {" "}/ {PLAN_FEATURES[currentPlan]?.storageGB}GB
              </span>
            </p>
          </div>
          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-xs text-stone-500 font-medium mb-1">Plan</p>
            <p className="text-lg font-bold text-stone-900 capitalize">
              {currentPlanDetails.name}
            </p>
          </div>
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
              <span className="text-xs bg-stone-100 text-[#8B7355] px-1.5 py-0.5 rounded-md font-semibold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(["basic", "pro", "ultimate"] as Plan[]).map((plan) => {
            const details = PLAN_DETAILS[plan];
            const isCurrent = plan === currentPlan;
            const isGold = plan === "ultimate";
            const isSage = plan === "pro";

            return (
              <div
                key={plan}
                className={`relative bg-white rounded-2xl border-2 transition-all p-6 ${
                  isCurrent
                    ? isGold
                      ? "border-[#C9A96E] shadow-md"
                      : "border-[#8B7355] shadow-md"
                    : "border-stone-200 hover:border-stone-200 hover:shadow-sm"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm ${
                        isGold ? "bg-[#C9A96E]" : "bg-[#8B7355]"
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
                      ? "bg-[#8B7355] hover:bg-[#7A6347] text-white shadow-sm"
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
                  ) : plan === "basic" ? (
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
                  Basic
                  <br />
                  <span className="text-stone-900 font-bold normal-case text-sm">$49</span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#8B7355] uppercase tracking-wide">
                  Pro
                  <br />
                  <span className="text-stone-900 font-bold normal-case text-sm">$99</span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#C9A96E] uppercase tracking-wide">
                  Ultimate
                  <br />
                  <span className="text-stone-900 font-bold normal-case text-sm">$199</span>
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
                    <CheckCell value={row.basic} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <CheckCell value={row.pro} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <CheckCell value={row.ultimate} />
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
              className="text-xs text-[#8B7355] hover:underline"
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
                          <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" className="text-xs text-[#8B7355] hover:underline">
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
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 inline-block">
              <p className="text-sm font-semibold text-red-700 mb-2">Cancel your subscription?</p>
              <p className="text-sm text-red-600 mb-4">You&apos;ll lose access at the end of the billing period.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setShowCancelConfirm(false)} className="px-4 py-2 border border-stone-200 text-stone-700 text-sm rounded-lg hover:bg-stone-50">Keep Subscription</button>
                <button onClick={handleManageBilling} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">Cancel via Portal</button>
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
        <a href="mailto:hello@nexpura.com" className="text-[#8B7355] hover:underline">
          Contact us
        </a>
      </p>
    </div>
  );
}
