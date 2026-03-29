"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";

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
      try {
        setStatus("success");
      } catch {
        setStatus("error");
      }
    }
    verifySession();
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="font-serif text-2xl tracking-[0.12em] text-stone-900 mb-8">NEXPURA</div>
        <Loader2 size={32} className="text-stone-400 animate-spin mx-auto mb-4" />
        <h1 className="font-serif text-xl text-stone-900 mb-2">Setting up your account...</h1>
        <p className="text-stone-500 text-sm">This will only take a moment.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="bg-white rounded-2xl border border-stone-200/60 p-10 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">!</span>
          </div>
          <h1 className="font-serif text-xl text-stone-900 mb-2">Something went wrong</h1>
          <p className="text-stone-500 text-sm mb-6">
            We couldn&apos;t verify your payment. If you were charged, please contact support.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] text-white rounded-full text-sm font-medium shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            Try again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-10">
        <Link href="/" className="font-serif text-2xl tracking-[0.12em] text-stone-900">NEXPURA</Link>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/60 p-10 shadow-sm text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>

        <h1 className="font-serif text-3xl text-stone-900 mb-3">Welcome to Nexpura!</h1>
        <p className="text-stone-500 text-sm mb-8">
          Your account has been created. You&apos;re all set to start your 14-day free trial.
        </p>

        {subdomain ? (
          <a
            href={`https://${subdomain}.nexpura.com/dashboard`}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] text-white rounded-full text-sm font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            Go to your dashboard
            <ArrowRight size={16} />
          </a>
        ) : (
          <Link
            href="/onboarding"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] text-white rounded-full text-sm font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            Complete setup
            <ArrowRight size={16} />
          </Link>
        )}

        <div className="mt-8 pt-6 border-t border-stone-100">
          <h3 className="text-sm font-medium text-stone-900 mb-3">What&apos;s next?</h3>
          <ul className="text-sm text-stone-500 space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-stone-900 mt-0.5 font-medium">1.</span>
              Complete your business profile
            </li>
            <li className="flex items-start gap-2">
              <span className="text-stone-900 mt-0.5 font-medium">2.</span>
              Add your inventory and customers
            </li>
            <li className="flex items-start gap-2">
              <span className="text-stone-900 mt-0.5 font-medium">3.</span>
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
          <div className="font-serif text-2xl tracking-[0.12em] text-stone-900 mb-6">NEXPURA</div>
          <Loader2 size={32} className="text-stone-400 animate-spin mx-auto" />
        </div>
      }
    >
      <SignupSuccessContent />
    </Suspense>
  );
}
