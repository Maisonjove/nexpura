"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "./actions";

type Plan = "basic" | "pro" | "ultimate";

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
  highlight?: "sage" | "gold";
  badge?: string;
  recommended?: boolean;
}

const PLANS: PlanCard[] = [
  {
    id: "basic",
    name: "Basic",
    price: "AUD $49",
    features: [
      "Up to 1 user",
      "Customers & CRM",
      "Bespoke Jobs & Repairs",
      "Inventory Management",
      "Invoicing & Payments",
      "Digital Jewellery Passports",
      "5GB storage",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "AUD $99",
    features: [
      "Up to 5 users",
      "Everything in Basic",
      "AI Business Copilot",
      "20GB storage",
      "Priority support",
    ],
    highlight: "sage",
    recommended: true,
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: "AUD $199",
    features: [
      "Unlimited users",
      "Everything in Pro",
      "AI Website Builder",
      "Custom domain",
      "100GB storage",
      "White-glove onboarding",
    ],
    highlight: "gold",
    badge: "Most powerful",
  },
];

const CheckIcon = () => (
  <svg
    className="w-3.5 h-3.5 text-sage flex-shrink-0"
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

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");

  // Step 2
  const [selectedPlan, setSelectedPlan] = useState<Plan>("pro");

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
      const result = await completeOnboarding(
        businessName,
        businessType,
        selectedPlan
      );
      if (result?.error) {
        setError(result.error);
        setStep(2);
      }
    });
  }

  const planLabel =
    PLANS.find((p) => p.id === selectedPlan)?.name ?? selectedPlan;

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      {/* Top bar */}
      <div className="border-b border-platinum bg-white px-6 py-4">
        <span className="font-fraunces text-xl font-semibold text-forest">
          Nexpura
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Progress indicator */}
        <div className="w-full max-w-2xl mb-10">
          <div className="flex items-center justify-center gap-0">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      s < step
                        ? "bg-sage text-white shadow-sm"
                        : s === step
                        ? "bg-forest text-white shadow-md ring-4 ring-forest/20"
                        : "bg-white border-2 border-platinum text-forest/30"
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
                    className={`mt-1.5 text-xs font-medium transition-colors ${
                      s === step ? "text-forest" : "text-forest/40"
                    }`}
                  >
                    {s === 1 ? "Business" : s === 2 ? "Choose Plan" : "Done"}
                  </span>
                </div>
                {s < 3 && (
                  <div
                    className={`w-24 h-0.5 mb-5 mx-1 transition-all duration-300 ${
                      s < step ? "bg-sage" : "bg-platinum"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 — Business Info */}
        {step === 1 && (
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="font-fraunces text-3xl font-semibold text-forest mb-2">
                Welcome to Nexpura!
              </h1>
              <p className="text-forest/60 text-base">
                Let&apos;s set up your jewellery business.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-platinum shadow-sm p-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-forest mb-1.5">
                  Business name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                  placeholder="e.g. Smith & Sons Jewellers"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-platinum bg-ivory text-forest placeholder-forest/30 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-forest mb-1.5">
                  Business type
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-platinum bg-ivory text-forest focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage transition-all text-sm appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23071A0D' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 12px center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "16px",
                    paddingRight: "40px",
                  }}
                >
                  <option value="">Select a type…</option>
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
                className="w-full bg-sage hover:bg-sage/90 disabled:bg-sage/40 text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-sm"
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

        {/* Step 2 — Choose Plan */}
        {step === 2 && (
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
              <h1 className="font-fraunces text-3xl font-semibold text-forest mb-2">
                Choose your plan
              </h1>
              <p className="text-forest/60 text-base">
                14-day free trial · No credit card required
              </p>
            </div>

            {error && (
              <div className="max-w-md mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl border-2 transition-all hover:shadow-md ${
                    plan.highlight === "sage"
                      ? "border-sage shadow-sm"
                      : plan.highlight === "gold"
                      ? "border-[#C9A96E] shadow-sm"
                      : "border-platinum hover:border-platinum/60"
                  }`}
                >
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-sage text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                        Most popular
                      </span>
                    </div>
                  )}
                  {plan.badge && !plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-[#C9A96E] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-6">
                    <div className="mb-4">
                      <h3
                        className={`font-fraunces text-xl font-semibold mb-1 ${
                          plan.highlight === "gold"
                            ? "text-[#C9A96E]"
                            : "text-forest"
                        }`}
                      >
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-forest">
                          {plan.price}
                        </span>
                        <span className="text-forest/50 text-sm">/mo</span>
                      </div>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2 text-sm text-forest/70"
                        >
                          <CheckIcon />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all shadow-sm ${
                        plan.highlight === "sage"
                          ? "bg-sage hover:bg-sage/90 text-white"
                          : plan.highlight === "gold"
                          ? "bg-[#C9A96E] hover:bg-[#C9A96E]/90 text-white"
                          : "bg-white border-2 border-forest text-forest hover:bg-forest hover:text-white"
                      }`}
                    >
                      Start Free Trial
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-forest/50">
              You can upgrade or downgrade anytime.
            </p>

            <button
              onClick={() => setStep(1)}
              className="mt-4 mx-auto flex items-center gap-1.5 text-sm text-forest/50 hover:text-forest transition-colors"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
          </div>
        )}

        {/* Step 3 — Confirmation */}
        {step === 3 && (
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl border border-platinum shadow-sm p-10 text-center">
              {/* Success icon */}
              <div className="w-16 h-16 rounded-full bg-sage/15 flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-sage"
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

              <h2 className="font-fraunces text-2xl font-semibold text-forest mb-2">
                You&apos;re all set!
              </h2>
              <p className="text-forest/60 text-sm mb-8">
                Your 14-day free trial has started
              </p>

              <div className="bg-ivory rounded-xl p-4 mb-8 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-forest/60">Business</span>
                  <span className="font-semibold text-forest">
                    {businessName}
                  </span>
                </div>
                <div className="h-px bg-platinum" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-forest/60">Plan</span>
                  <span className="font-semibold text-forest capitalize">
                    {planLabel} Plan
                  </span>
                </div>
                <div className="h-px bg-platinum" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-forest/60">Trial ends</span>
                  <span className="font-semibold text-forest">
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
                className="w-full bg-sage hover:bg-sage/90 disabled:bg-sage/50 text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-sm"
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
                    Setting up your workspace…
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
                className="mt-3 text-sm text-forest/40 hover:text-forest/70 transition-colors"
              >
                Change plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
