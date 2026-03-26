"use client";

import { useState, useTransition, useEffect } from "react";
import { completeOnboarding } from "./actions";
import { Gem, Mail, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Plan = "boutique" | "studio" | "atelier";

const BUSINESS_TYPES = [
  "Independent Jeweller",
  "Jewellery Studio",
  "Retail Store",
  "Workshop",
  "Online Store",
  "Other",
];

interface PlanCard {
  id: Plan;
  name: string;
  price: string;
  features: string[];
  recommended?: boolean;
}

const PLANS: PlanCard[] = [
  {
    id: "boutique",
    name: "Boutique",
    price: "AUD $89",
    features: [
      "Up to 2 staff",
      "Customers & CRM",
      "Bespoke Jobs & Repairs",
      "Inventory Management",
      "Invoicing & Payments",
      "Digital Jewellery Passports",
      "5GB storage",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: "AUD $179",
    features: [
      "Up to 10 staff",
      "Everything in Boutique",
      "AI Business Copilot",
      "20GB storage",
      "Priority support",
    ],
    recommended: true,
  },
  {
    id: "atelier",
    name: "Atelier",
    price: "$299",
    features: [
      "Unlimited staff",
      "Unlimited stores",
      "Everything in Studio",
      "AI Website Builder",
      "Custom domain",
      "100GB storage",
    ],
  },
];

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("studio");

  // Email verification
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

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

  async function handleResendVerification() {
    if (!userEmail) return;
    setResendLoading(true);
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email: userEmail });
    setResendLoading(false);
    setResendSent(true);
  }

  function handleContinue() {
    if (!businessName.trim()) return;
    setStep(2);
  }

  function handleSelectPlan(plan: Plan) {
    setSelectedPlan(plan);
    setStep(3);
  }

  function handleGoToDashboard() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding(businessName, businessType, selectedPlan);
      if (result?.error) {
        setError(result.error);
        setStep(2);
      }
    });
  }

  const planLabel = PLANS.find((p) => p.id === selectedPlan)?.name ?? selectedPlan;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top bar */}
      <div className="border-b border-stone-200 bg-white px-6 py-4 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-amber-700 flex items-center justify-center">
          <Gem size={14} color="white" />
        </div>
        <span className="text-sm font-semibold text-stone-900">Nexpura</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Progress indicator */}
        <div className="w-full max-w-2xl mb-10">
          <div className="flex items-center justify-center gap-0">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    s < step
                      ? "bg-amber-700 text-white"
                      : s === step
                      ? "bg-stone-900 text-white ring-4 ring-stone-200"
                      : "bg-white border-2 border-stone-200 text-stone-400"
                  }`}>
                    {s < step ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : s}
                  </div>
                  <span className={`mt-1.5 text-xs font-medium ${s === step ? "text-stone-900" : "text-stone-400"}`}>
                    {s === 1 ? "Business" : s === 2 ? "Choose Plan" : "Done"}
                  </span>
                </div>
                {s < 3 && (
                  <div className={`w-24 h-0.5 mb-5 mx-1 ${s < step ? "bg-amber-700" : "bg-stone-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Email verification banner */}
        {emailVerified === false && (
          <div className="w-full max-w-2xl mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail size={18} className="text-amber-700" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Please verify your email</p>
              <p className="text-xs text-amber-700 mt-1">
                We sent a verification link to <strong>{userEmail}</strong>. Click the link in the email to verify your account.
              </p>
              {resendSent ? (
                <p className="text-xs text-emerald-700 mt-2 font-medium">✓ Verification email resent!</p>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900 transition-colors"
                >
                  <RefreshCw size={12} className={resendLoading ? "animate-spin" : ""} />
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 1 — Business Info */}
        {step === 1 && (
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-stone-900 mb-2">Welcome to Nexpura!</h1>
              <p className="text-stone-500 text-sm">Let&apos;s set up your jewellery business.</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-8 space-y-5">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  Business name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                  placeholder="e.g. Smith & Sons Jewellers"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  Business type
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
                >
                  <option value="">Select a type…</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleContinue}
                disabled={!businessName.trim()}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-md transition-colors text-sm flex items-center justify-center gap-2"
              >
                Continue
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Choose Plan */}
        {step === 2 && (
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-stone-900 mb-2">Choose your plan</h1>
              <p className="text-stone-400 text-sm">14-day free trial · No credit card required</p>
            </div>

            {error && (
              <div className="max-w-md mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-xl border-2 transition-all hover:shadow-md ${
                    plan.recommended ? "border-amber-600 shadow-sm" : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most popular
                      </span>
                    </div>
                  )}
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-stone-900 mb-1">{plan.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-stone-900">{plan.price}</span>
                        <span className="text-stone-400 text-sm">/mo</span>
                      </div>
                    </div>
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-stone-600">
                          <CheckIcon />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`w-full py-2.5 rounded-md font-semibold text-sm transition-all ${
                        plan.recommended
                          ? "bg-amber-700 hover:bg-amber-800 text-white"
                          : "bg-white border-2 border-stone-200 text-stone-700 hover:border-stone-300"
                      }`}
                    >
                      Start Free Trial
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-stone-400">You can upgrade or downgrade anytime.</p>
            <button
              onClick={() => setStep(1)}
              className="mt-4 mx-auto flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        )}

        {/* Step 3 — Confirmation */}
        {step === 3 && (
          <div className="w-full max-w-md">
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-stone-900 mb-2">You&apos;re all set!</h2>
              <p className="text-stone-400 text-sm mb-8">Your 14-day free trial has started</p>

              <div className="bg-stone-50 rounded-lg p-4 mb-8 space-y-3 text-left">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">Business</span>
                  <span className="font-semibold text-stone-900">{businessName}</span>
                </div>
                <div className="h-px bg-stone-200" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">Plan</span>
                  <span className="font-semibold text-stone-900 capitalize">{planLabel} Plan</span>
                </div>
                <div className="h-px bg-stone-200" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">Trial ends</span>
                  <span className="font-semibold text-stone-900">
                    {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("en-AU", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGoToDashboard}
                disabled={isPending}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-md transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Setting up your workspace…
                  </>
                ) : (
                  <>
                    Go to Dashboard
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
              <button onClick={() => setStep(2)} className="mt-3 text-sm text-stone-400 hover:text-stone-600 transition-colors">
                Change plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
