"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gem, Check, X, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { debounce } from "@/lib/utils";

type Plan = "boutique" | "studio" | "atelier";

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
    price: "$89",
    features: [
      "1 staff member",
      "Customers & CRM",
      "Repairs & Bespoke",
      "Inventory Management",
      "Invoicing & Payments",
      "Digital Passports",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$179",
    features: [
      "Up to 5 staff",
      "Everything in Boutique",
      "Website Builder",
      "Full Analytics",
      "Priority support",
    ],
    recommended: true,
  },
  {
    id: "atelier",
    name: "Atelier",
    price: "$299",
    features: [
      "Unlimited staff & stores",
      "Everything in Studio",
      "AI Website Copy",
      "Custom domain",
      "White-label options",
    ],
  },
];

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlan = searchParams.get("plan") as Plan | null;

  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<Plan>(preselectedPlan || "studio");

  // Step 2: Subdomain
  const [subdomain, setSubdomain] = useState("");
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [subdomainError, setSubdomainError] = useState("");

  // Step 3: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Debounced subdomain check
  const checkSubdomain = useCallback(
    debounce(async (value: string) => {
      if (!value || value.length < 3) {
        setSubdomainStatus("idle");
        return;
      }

      setSubdomainStatus("checking");
      try {
        const res = await fetch(`/api/check-subdomain?subdomain=${encodeURIComponent(value)}`);
        const data = await res.json();

        if (data.available) {
          setSubdomainStatus("available");
          setSubdomainError("");
        } else {
          setSubdomainStatus(data.error?.includes("format") ? "invalid" : "taken");
          setSubdomainError(data.error || "Subdomain unavailable");
        }
      } catch {
        setSubdomainStatus("idle");
        setSubdomainError("Failed to check availability");
      }
    }, 400),
    []
  );

  useEffect(() => {
    const normalized = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (normalized !== subdomain) {
      setSubdomain(normalized);
      return;
    }
    checkSubdomain(normalized);
  }, [subdomain, checkSubdomain]);

  function handleSelectPlan(plan: Plan) {
    setSelectedPlan(plan);
    setStep(2);
  }

  function handleSubdomainContinue() {
    if (subdomainStatus !== "available") return;
    setStep(3);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (subdomainStatus !== "available") {
      setError("Please choose an available subdomain");
      setStep(2);
      return;
    }

    setLoading(true);
    setError(null);

    // First create the Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Now redirect to Stripe checkout
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          subdomain,
          email,
          fullName,
        }),
      });

      const data = await res.json();

      if (data.error) {
        // If Stripe fails (e.g., missing prices), fall back to direct onboarding
        console.warn("Stripe checkout failed, falling back to trial:", data.error);
        router.push("/onboarding");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        router.push("/onboarding");
      }
    } catch {
      // On any error, proceed to onboarding (trial mode)
      router.push("/onboarding");
    }
  }

  const planLabel = PLANS.find((p) => p.id === selectedPlan)?.name ?? selectedPlan;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg bg-amber-700 flex items-center justify-center">
            <Gem size={18} color="white" />
          </div>
          <span className="text-xl font-semibold text-stone-900">Nexpura</span>
        </div>
        <p className="text-sm text-stone-400">Cloud OS for Jewellery Businesses</p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-0 mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  s < step
                    ? "bg-amber-700 text-white"
                    : s === step
                    ? "bg-stone-900 text-white ring-4 ring-stone-200"
                    : "bg-white border-2 border-stone-200 text-stone-400"
                }`}
              >
                {s < step ? <Check size={16} /> : s}
              </div>
              <span className={`mt-1.5 text-xs font-medium ${s === step ? "text-stone-900" : "text-stone-400"}`}>
                {s === 1 ? "Plan" : s === 2 ? "Subdomain" : "Account"}
              </span>
            </div>
            {s < 3 && <div className={`w-20 h-0.5 mb-5 mx-1 ${s < step ? "bg-amber-700" : "bg-stone-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Choose Plan */}
      {step === 1 && (
        <div>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-stone-900 mb-2">Choose your plan</h1>
            <p className="text-stone-500 text-sm">14-day free trial · No credit card required</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-xl border-2 transition-all hover:shadow-md cursor-pointer ${
                  plan.recommended ? "border-amber-600 shadow-sm" : "border-stone-200 hover:border-stone-300"
                } ${selectedPlan === plan.id ? "ring-2 ring-amber-600 ring-offset-2" : ""}`}
                onClick={() => setSelectedPlan(plan.id)}
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
                      <span className="text-stone-400 text-sm">AUD/mo</span>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-stone-600">
                        <Check size={14} className="text-amber-700 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPlan(plan.id);
                    }}
                    className={`w-full py-2.5 rounded-md font-semibold text-sm transition-all ${
                      plan.recommended || selectedPlan === plan.id
                        ? "bg-amber-700 hover:bg-amber-800 text-white"
                        : "bg-white border-2 border-stone-200 text-stone-700 hover:border-stone-300"
                    }`}
                  >
                    Select {plan.name}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-stone-400 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-amber-700 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      )}

      {/* Step 2: Choose Subdomain */}
      {step === 2 && (
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-stone-900 mb-2">Choose your subdomain</h1>
            <p className="text-stone-500 text-sm">This will be your store&apos;s URL</p>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-8 shadow-sm">
            <div className="mb-6">
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Your store URL
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="your-store"
                  autoFocus
                  className="flex-1 px-3 py-2.5 rounded-l-md border border-r-0 border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
                />
                <span className="px-3 py-2.5 bg-stone-100 border border-stone-200 rounded-r-md text-stone-500 text-sm">
                  .nexpura.com
                </span>
              </div>

              {/* Status indicator */}
              <div className="mt-2 h-5">
                {subdomainStatus === "checking" && (
                  <div className="flex items-center gap-2 text-stone-400 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Checking availability...
                  </div>
                )}
                {subdomainStatus === "available" && (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm">
                    <Check size={14} />
                    {subdomain}.nexpura.com is available!
                  </div>
                )}
                {(subdomainStatus === "taken" || subdomainStatus === "invalid") && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <X size={14} />
                    {subdomainError}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-stone-50 rounded-lg p-4 mb-6">
              <p className="text-xs text-stone-500">
                <strong>Selected plan:</strong> {planLabel} (${PLANS.find((p) => p.id === selectedPlan)?.price.replace("$", "")}/mo)
              </p>
            </div>

            <button
              onClick={handleSubdomainContinue}
              disabled={subdomainStatus !== "available"}
              className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md transition-colors text-sm flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full mt-3 text-sm text-stone-400 hover:text-stone-600 transition-colors flex items-center justify-center gap-1"
            >
              <ArrowLeft size={14} />
              Back to plans
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Create Account */}
      {step === 3 && (
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-stone-900 mb-2">Create your account</h1>
            <p className="text-stone-500 text-sm">Almost there! Just a few more details.</p>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-8 shadow-sm">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">
                <strong>{subdomain}.nexpura.com</strong> on the <strong>{planLabel}</strong> plan
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  Your name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  Work email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@yourshop.com"
                  className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-md">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60 text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Start 14-day free trial
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-stone-400 mt-4">
              By signing up you agree to our{" "}
              <a href="/terms" className="underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline">
                Privacy Policy
              </a>
              .
            </p>

            <button
              onClick={() => setStep(2)}
              className="w-full mt-4 text-sm text-stone-400 hover:text-stone-600 transition-colors flex items-center justify-center gap-1"
            >
              <ArrowLeft size={14} />
              Back to subdomain
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
            <Loader2 size={32} className="text-amber-600 animate-spin" />
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Loading...</h1>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
