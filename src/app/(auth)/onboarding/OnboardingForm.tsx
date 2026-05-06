"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { completeOnboarding } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/data/pricing";

type Plan = "boutique" | "studio" | "atelier";

const BUSINESS_TYPES = [
  "Independent Jeweller",
  "Jewellery Studio",
  "Retail Store",
  "Workshop",
  "Online Store",
  "Other",
];

// 2026-04-28: dropped the inline PLANS array + step-2 plan picker. The
// user already chose plan + currency on /pricing and paid through Stripe
// before reaching this page, so re-asking here was both redundant and
// shipping stale hardcoded prices ($89/$179/$299 AUD) that disagreed
// with the live multi-currency tier. Onboarding now only collects the
// pieces the Stripe form doesn't (business name + business type).

// Derive the workspace URL from a slug. The app routes tenants under a
// PATH segment (nexpura.com/<slug>/dashboard), not a subdomain. The
// previous subdomain-based URL https://<slug>.nexpura.com/dashboard
// produced "Safari can't open this page" on signup because (a) wildcard
// DNS isn't pointed at Vercel, and (b) for slug "nexpura" it generated
// the recursive nexpura.nexpura.com which browsers reject outright.
function getWorkspaceUrl(slug: string): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host.startsWith("127.") || host.endsWith(".local")) {
      return "/dashboard";
    }
  }
  return `https://nexpura.com/${slug}/dashboard`;
}

// Inner component that reads search params (must be wrapped in Suspense)
function OnboardingContent() {
  const searchParams = useSearchParams();
  const preselectedPlan = (searchParams.get("plan") as Plan | null) ?? "studio";
  const validPlans: Plan[] = ["boutique", "studio", "atelier"];
  const initialPlan: Plan = validPlans.includes(preselectedPlan)
    ? preselectedPlan
    : "studio";

  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  // selectedPlan is read-only now — the plan picker step is gone, but
  // we still pass it to completeOnboarding for backwards compat with old
  // sessions that pre-date the webhook-creates-tenant flow.
  const [selectedPlan] = useState<Plan>(initialPlan);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  // Workspace slug returned after successful onboarding
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (user) {
        setUserEmail(user.email ?? null);
        setEmailVerified(!!user.email_confirmed_at);
      }
    });
  }, []);

  useEffect(() => {
    // Once on step 2 (Done / email gate), poll Supabase for the email
    // confirmation. The wizard used to be 3 steps with the email gate at
    // step 3; renumbered after the plan picker was dropped.
    if (step !== 2 || emailVerified) return;
    const supabase = createClient();
    const interval = setInterval(async () => {
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getUser();
      if (data.user?.email_confirmed_at) {
        setEmailVerified(true);
        clearInterval(interval);
        handleGoToDashboard();
      }
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, emailVerified]);

  async function handleResendVerification() {
    if (!userEmail) return;
    setResendLoading(true);
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email: userEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
      },
    });
    setResendLoading(false);
    setResendSent(true);
  }

  function handleContinue() {
    if (!businessName.trim()) return;
    // Plan was set in Stripe Checkout — skip the plan picker step and go
    // straight to the "verify email + go to dashboard" confirmation step.
    setStep(2);
    handleGoToDashboard();
  }

  function handleGoToDashboard() {
    setError(null);
    startTransition(async () => {
      // selectedPlan is still passed for backwards-compat with old sessions
      // that pre-date the webhook-creates-tenant flow; it's a no-op when
      // the user already has a Stripe-paid tenant linked (the typical case).
      const result = await completeOnboarding(
        businessName,
        businessType,
        selectedPlan
      );
      if (result?.error) {
        setError(result.error);
        setStep(1);
        return;
      }
      if (result?.slug) {
        // Show the workspace URL to the user before navigating
        setWorkspaceSlug(result.slug);
      } else {
        // Fallback: no slug returned, navigate directly
        window.location.href = "/dashboard";
      }
    });
  }

  function handleOpenWorkspace() {
    if (!workspaceSlug) return;
    window.location.href = getWorkspaceUrl(workspaceSlug);
  }

  const planLabel =
    PLANS.find((p) => p.id === selectedPlan)?.name ?? selectedPlan;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-stone-100 bg-white px-6 py-5 flex items-center">
        <span className="font-serif text-lg tracking-[0.12em] text-stone-900">
          NEXPURA
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Progress indicator — 2 steps now (Business → Done). Plan
            picker step removed; plan was already chosen on /pricing. */}
        <div className="w-full max-w-2xl mb-12">
          <div className="flex items-center justify-center gap-0">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      s < step
                        ? "bg-stone-900 text-white"
                        : s === step
                        ? "bg-stone-900 text-white ring-4 ring-stone-200"
                        : "bg-white border-2 border-stone-200 text-stone-400"
                    }`}
                  >
                    {s < step ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      s
                    )}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-medium ${
                      s === step ? "text-stone-900" : "text-stone-400"
                    }`}
                  >
                    {s === 1 ? "Business" : "Done"}
                  </span>
                </div>
                {s < 2 && (
                  <div
                    className={`w-24 h-0.5 mb-5 mx-1 ${
                      s < step ? "bg-stone-900" : "bg-stone-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 - Business Info */}
        {step === 1 && (
          <div className="w-full max-w-md">
            <div className="text-center mb-10">
              <h1 className="font-serif text-3xl text-stone-900 mb-3">
                Welcome to Nexpura!
              </h1>
              <p className="text-stone-400 text-sm">
                Let&apos;s set up your jewellery business.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-8 space-y-5">
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                  Business name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                  placeholder="e.g. Smith & Sons Jewellers"
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                  Business type
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
                >
                  <option value="">Select a type</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleContinue}
                disabled={!businessName.trim()}
                className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] disabled:opacity-40 text-white font-semibold py-3 rounded-full transition-all text-sm flex items-center justify-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
              >
                Continue
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 - Confirmation / Email gate
            (was step 3 in the 3-step wizard; the old Plan-picker step
            between Business and Done has been removed — see the comment
            at the top of this file.) */}
        {step === 2 && (
          <div className="w-full max-w-md">
            {emailVerified === false ? (
              /* Email not yet verified */
              <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="font-serif text-2xl text-stone-900 mb-3">
                  Check your inbox
                </h2>
                <p className="text-stone-500 text-sm mb-2">
                  We sent a verification link to
                </p>
                <p className="font-semibold text-stone-900 text-sm mb-6">
                  {userEmail}
                </p>
                <p className="text-stone-400 text-xs mb-8">
                  Click the link in the email to verify your account. This page
                  will open the dashboard automatically once verified.
                </p>
                <div className="flex items-center justify-center gap-2 text-stone-400 text-sm mb-8">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Waiting for verification
                </div>
                {resendSent ? (
                  <p className="text-xs text-emerald-700 font-medium mb-4">
                    Verification email resent!
                  </p>
                ) : (
                  <button
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="text-sm text-stone-500 hover:text-stone-900 transition-colors underline underline-offset-2 mb-4"
                  >
                    {resendLoading ? "Sending" : "Resend verification email"}
                  </button>
                )}
                <button
                  onClick={() => setStep(2)}
                  className="mt-2 block mx-auto text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Change plan
                </button>
              </div>
            ) : workspaceSlug ? (
              /* Onboarding complete -- show workspace URL */
              <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="font-serif text-3xl text-stone-900 mb-2">
                  Your workspace is ready!
                </h2>
                <p className="text-stone-400 text-sm mb-6">
                  You have a private, secure URL just for your business.
                </p>

                {/* Workspace URL pill */}
                <div className="bg-stone-50 border border-stone-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-3">
                  <div className="text-left min-w-0">
                    <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-0.5">
                      Your workspace URL
                    </p>
                    <p className="text-stone-900 font-semibold text-sm truncate">
                      {workspaceSlug}.nexpura.com
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `https://${workspaceSlug}.nexpura.com`
                      );
                    }}
                    title="Copy URL"
                    className="flex-shrink-0 p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-700"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>

                <p className="text-xs text-stone-400 mb-8">
                  Bookmark this URL -- it&apos;s the only way to access your
                  workspace.
                </p>

                <button
                  onClick={handleOpenWorkspace}
                  className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] hover:from-[#4a4a4a] hover:to-[#2a2a2a] text-white font-semibold py-3 rounded-full transition-all text-sm flex items-center justify-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  Open My Workspace
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              /* Email verified -- show summary + go to dashboard */
              <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="font-serif text-3xl text-stone-900 mb-3">
                  You&apos;re all set!
                </h2>
                <p className="text-stone-400 text-sm mb-8">
                  Your 14-day free trial has started
                </p>
                <div className="bg-stone-50 rounded-lg p-4 mb-8 space-y-3 text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Business</span>
                    <span className="font-semibold text-stone-900">
                      {businessName}
                    </span>
                  </div>
                  <div className="h-px bg-stone-200" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Plan</span>
                    <span className="font-semibold text-stone-900 capitalize">
                      {planLabel} Plan
                    </span>
                  </div>
                  <div className="h-px bg-stone-200" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Trial ends</span>
                    <span className="font-semibold text-stone-900">
                      {new Date(
                        Date.now() + 14 * 24 * 60 * 60 * 1000
                      ).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleGoToDashboard}
                  disabled={isPending}
                  className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] hover:from-[#4a4a4a] hover:to-[#2a2a2a] disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-all text-sm flex items-center justify-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  {isPending ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Setting up your workspace
                    </>
                  ) : (
                    <>
                      Go to Dashboard
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="mt-3 text-sm text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Change plan
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingForm() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <span className="font-serif text-lg tracking-[0.12em] text-stone-900">
              NEXPURA
            </span>
            <div className="mt-4">
              <svg
                className="w-6 h-6 animate-spin text-stone-400 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          </div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
