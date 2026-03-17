"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Gem, CheckCircle, Loader2, ArrowRight } from "lucide-react";

function SignupSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    async function verifySession() {
      if (!sessionId) {
        setStatus("error");
        return;
      }

      // In production, verify the session with your backend
      // For now, we'll just show success and extract subdomain from session
      try {
        // The webhook will have created the tenant by now
        // We can redirect to their subdomain or onboarding
        setStatus("success");
        
        // Try to get subdomain from session metadata via API
        // (would need to implement this endpoint)
        // For now, just show generic success
      } catch {
        setStatus("error");
      }
    }

    verifySession();
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
          <Loader2 size={32} className="text-amber-600 animate-spin" />
        </div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Setting up your account...</h1>
        <p className="text-stone-500 text-sm">This will only take a moment.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="bg-white rounded-xl border border-stone-200 p-10 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Something went wrong</h1>
          <p className="text-stone-500 text-sm mb-6">
            We couldn&apos;t verify your payment. If you were charged, please contact support.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-md hover:bg-amber-800 transition-colors text-sm font-medium"
          >
            Try again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg bg-amber-700 flex items-center justify-center">
            <Gem size={18} color="white" />
          </div>
          <span className="text-xl font-semibold text-stone-900">Nexpura</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-10 shadow-sm text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>

        <h1 className="text-2xl font-semibold text-stone-900 mb-2">Welcome to Nexpura!</h1>
        <p className="text-stone-500 text-sm mb-8">
          Your account has been created. You&apos;re all set to start your 14-day free trial.
        </p>

        {subdomain ? (
          <a
            href={`https://${subdomain}.nexpura.com/dashboard`}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors text-sm font-semibold"
          >
            Go to your dashboard
            <ArrowRight size={16} />
          </a>
        ) : (
          <Link
            href="/onboarding"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors text-sm font-semibold"
          >
            Complete setup
            <ArrowRight size={16} />
          </Link>
        )}

        <div className="mt-8 pt-6 border-t border-stone-100">
          <h3 className="text-sm font-medium text-stone-900 mb-3">What&apos;s next?</h3>
          <ul className="text-sm text-stone-500 space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">1.</span>
              Complete your business profile
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">2.</span>
              Add your inventory and customers
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">3.</span>
              Start using POS, repairs, and bespoke tracking
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function SignupSuccessPage() {
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
      <SignupSuccessContent />
    </Suspense>
  );
}
