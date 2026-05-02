"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, X, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { debounce } from "@/lib/utils";
import PasswordStrength, { scorePassword } from "@/components/PasswordStrength";
import { PLANS, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/data/pricing";

// Two-step wizard: Subdomain → Account.
// The plan + currency picker lives on /pricing — that's where users come
// from. We read the chosen plan + currency from the URL; if either is
// missing we send the user back to /pricing instead of resurrecting an
// out-of-date duplicate plan-picker here. (Joey 2026-04-28: the old
// step-1 picker still showed hardcoded $89/$179/$299 AUD prices that
// had since been replaced by the multi-currency tier on /pricing.)

type Plan = "boutique" | "studio" | "atelier";
const PLAN_IDS: Plan[] = ["boutique", "studio", "atelier"];

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") as Plan | null;
  const currencyParam = (searchParams.get("currency") || "").toUpperCase();

  const validPlan = planParam && PLAN_IDS.includes(planParam) ? planParam : null;
  const validCurrency: CurrencyCode | null = SUPPORTED_CURRENCIES.includes(
    currencyParam as CurrencyCode,
  )
    ? (currencyParam as CurrencyCode)
    : null;

  // Send the user back to /pricing if they landed here without picking
  // a plan + currency first. Anything else would mean making a fake
  // default choice on their behalf.
  useEffect(() => {
    if (!validPlan || !validCurrency) {
      router.replace("/pricing");
    }
  }, [validPlan, validCurrency, router]);

  const selectedPlan = validPlan ?? "studio";
  const selectedCurrency = validCurrency ?? "USD";

  const planRow = PLANS.find((p) => p.id === selectedPlan);
  const planLabel = planRow?.name ?? selectedPlan;
  const planPrice = planRow?.pricing[selectedCurrency];

  const [step, setStep] = useState(1);

  const [subdomain, setSubdomain] = useState("");
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [subdomainError, setSubdomainError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

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

  function handleSubdomainContinue() {
    if (subdomainStatus !== "available") return;
    setStep(2);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (subdomainStatus !== "available") {
      setError("Please choose an available subdomain");
      setStep(1);
      return;
    }

    const strength = scorePassword(password);
    if (!strength.allowed) {
      setError("Please choose a stronger password before continuing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // SECURITY: Sign out any existing session before creating a new account.
      // Without this, a logged-in user's session cookie stays active after signUp()
      // (which returns no session when email confirmation is required), causing
      // completeOnboarding to run as the OLD user and redirect them to the wrong account.
      await supabase.auth.signOut();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
        },
      });

      if (authError) {
        const errorMessage = authError.message || authError.code || "Failed to create account";
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Capture user_id so the Stripe checkout session can carry it as
      // metadata. The webhook uses it to link this user to the tenant
      // it's about to create — without it, /onboarding creates a SECOND
      // orphan tenant (the duplicate-tenant bug Joey hit 2026-04-28).
      const userId = authData?.user?.id ?? null;

      // Per Joey 2026-04-26: trial is "card upfront, auto-charge on day 15"
      // — so we hand the user straight to Stripe Checkout. Stripe collects
      // the card, starts the 14-day trial, and bills automatically the
      // moment it ends. The webhook (api/webhooks/stripe) provisions the
      // tenant on `checkout.session.completed`, and Supabase will email a
      // confirmation link in parallel.
      const checkoutRes = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          currency: selectedCurrency,
          subdomain,
          email,
          fullName,
          userId,
        }),
      });
      const checkoutData = (await checkoutRes.json()) as { url?: string; error?: string };
      if (!checkoutRes.ok || !checkoutData.url) {
        setError(checkoutData.error || "Could not start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = checkoutData.url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      setLoading(false);
    }
  }

  // While the redirect to /pricing is in flight (URL missing plan/currency),
  // show a brief spinner instead of flashing a half-formed wizard.
  if (!validPlan || !validCurrency) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="font-serif text-2xl tracking-[0.12em] text-stone-900 mb-6">NEXPURA</div>
        <Loader2 size={32} className="text-stone-400 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="font-serif text-2xl tracking-[0.12em] text-stone-900">
          NEXPURA
        </Link>
      </div>

      {/* === Premium intro block — Batch 2.
          Adds Kaitlyn's spec headline + subcopy + trust bullets + a
          quieter "book a demo" link, all sitting above the existing
          wizard. The wizard's form-submit handlers + Supabase auth
          flow are untouched. */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="font-serif text-3xl sm:text-4xl text-stone-900 leading-[1.12] tracking-[-0.005em]">
          Start your 14-day Nexpura trial.
        </h1>
        <p className="mt-4 text-stone-500 text-[0.95rem] sm:text-[1rem] leading-[1.55] max-w-xl mx-auto">
          Explore POS, repairs, bespoke, inventory, digital passports, and
          reporting in one jewellery-specific platform.
        </p>
        <ul
          role="list"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.82rem] text-stone-500"
        >
          {[
            "No charge today",
            "Guided setup available",
            "Cancel anytime before your trial ends",
            "Built for jewellery workflows",
          ].map((bullet) => (
            <li key={bullet} className="inline-flex items-center gap-2">
              <Check size={13} className="text-emerald-600 flex-shrink-0" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Progress indicator — 2 steps now (Subdomain → Account) */}
      <div className="flex items-center justify-center gap-0 mb-12">
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
                {s < step ? <Check size={16} /> : s}
              </div>
              <span className={`mt-1.5 text-xs font-medium ${s === step ? "text-stone-900" : "text-stone-400"}`}>
                {s === 1 ? "Subdomain" : "Account"}
              </span>
            </div>
            {s < 2 && <div className={`w-20 h-0.5 mb-5 mx-1 ${s < step ? "bg-stone-900" : "bg-stone-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Choose Subdomain */}
      {step === 1 && (
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl text-stone-900 mb-3">Choose your subdomain</h1>
            <p className="text-stone-400 text-sm">This will be your store&apos;s URL</p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/60 p-8 shadow-sm">
            <div className="mb-6">
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Your store URL</label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="your-store"
                  autoFocus
                  className="flex-1 px-4 py-3 rounded-l-lg border border-r-0 border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
                />
                <span className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-r-lg text-stone-500 text-sm">
                  .nexpura.com
                </span>
              </div>

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

            {planPrice && (
              <div className="bg-stone-50 rounded-lg p-4 mb-6">
                <p className="text-xs text-stone-500">
                  <strong>Selected plan:</strong> {planLabel} ({planPrice.symbol}{planPrice.amount} {selectedCurrency}/mo)
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  Want a different plan?{" "}
                  <Link href="/pricing" className="underline hover:text-stone-700">Go back to pricing</Link>
                </p>
              </div>
            )}

            <button
              onClick={handleSubdomainContinue}
              disabled={subdomainStatus !== "available"}
              className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-full transition-all text-sm flex items-center justify-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>

          <p className="text-center text-sm text-stone-400 mt-6">
            Prefer a walkthrough?{" "}
            <Link
              href="/contact?intent=demo"
              className="text-stone-900 hover:opacity-70 transition-opacity font-medium underline underline-offset-4 decoration-stone-300 hover:decoration-stone-900"
            >
              Book a Guided Demo
            </Link>
          </p>

          <p className="text-center text-sm text-stone-400 mt-3">
            Already have an account?{" "}
            <Link href="/login" className="text-stone-900 hover:opacity-70 transition-opacity font-medium">
              Sign in
            </Link>
          </p>
        </div>
      )}

      {/* Step 2: Create Account */}
      {step === 2 && (
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl text-stone-900 mb-3">Create your account</h1>
            <p className="text-stone-400 text-sm">Almost there! Just a few more details.</p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/60 p-8 shadow-sm">
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-stone-700">
                <strong>{subdomain}.nexpura.com</strong> on the <strong>{planLabel}</strong> plan
                {planPrice && ` · ${planPrice.symbol}${planPrice.amount} ${selectedCurrency}/mo after the 14-day trial`}
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Your name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                  className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Work email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@yourshop.com"
                  className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                <PasswordStrength password={password} className="mt-2" />
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-2.5 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] hover:from-[#4a4a4a] hover:to-[#2a2a2a] text-white font-medium py-3 rounded-full transition-all disabled:opacity-60 text-sm flex items-center justify-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Start Free Trial
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Trial wording note — Batch 2 spec lock. */}
            <p className="text-center text-[12px] italic text-stone-500 mt-4 leading-[1.55]">
              Payment details are required to activate your trial. You will not be
              charged until your 14-day trial ends. You can cancel anytime before then.
            </p>

            <p className="text-center text-xs text-stone-400 mt-5">
              By signing up you agree to our{" "}
              <a href="/terms" className="underline">Terms</a> and{" "}
              <a href="/privacy" className="underline">Privacy Policy</a>.
            </p>

            {/* Secondary "book a demo" link — Batch 2 */}
            <p className="text-center text-[13px] text-stone-500 mt-5">
              Prefer a walkthrough?{" "}
              <Link
                href="/contact?intent=demo"
                className="text-stone-900 hover:opacity-70 transition-opacity font-medium underline underline-offset-4 decoration-stone-300 hover:decoration-stone-900"
              >
                Book a Guided Demo
              </Link>
            </p>

            <button
              onClick={() => setStep(1)}
              className="w-full mt-6 text-sm text-stone-400 hover:text-stone-600 transition-colors flex items-center justify-center gap-1"
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
          <div className="font-serif text-2xl tracking-[0.12em] text-stone-900 mb-6">NEXPURA</div>
          <Loader2 size={32} className="text-stone-400 animate-spin mx-auto" />
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
