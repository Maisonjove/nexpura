"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Get current user email
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  // Listen for email verification — redirect as soon as it's done
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
          session?.user?.email_confirmed_at
        ) {
          subscription.unsubscribe();
          router.push("/onboarding");
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [router]);

  async function handleResend() {
    if (!email) return;
    setResendLoading(true);
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
      },
    });
    setResendLoading(false);
    setResendSent(true);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="font-serif text-2xl text-stone-900 mb-3">Verify your email</h1>
        <p className="text-stone-500 text-sm mb-2">
          A verification link was sent to
        </p>
        {email && (
          <p className="font-semibold text-stone-900 text-sm mb-6">{email}</p>
        )}
        <p className="text-stone-400 text-xs mb-8">
          You must verify your email before accessing the platform. Click the link in your inbox — this page will redirect you automatically once verified.
        </p>

        {/* Spinner */}
        <div className="flex items-center justify-center gap-2 text-stone-400 text-sm mb-8">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Waiting for verification…
        </div>

        {/* Resend */}
        {resendSent ? (
          <p className="text-xs text-emerald-700 font-medium mb-6">Verification email resent!</p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendLoading || !email}
            className="text-sm text-stone-500 hover:text-stone-900 transition-colors underline underline-offset-2 mb-6 block mx-auto"
          >
            {resendLoading ? "Sending…" : "Resend verification email"}
          </button>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}
