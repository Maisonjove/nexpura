"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import PasswordStrength, { scorePassword } from "@/components/PasswordStrength";

interface Props {
  token: string;
  invite: {
    id: string;
    name: string;
    email: string;
    role: string;
    businessName: string;
  };
}

type UIState = "form" | "waiting" | "accepting" | "error";

export default function InviteClient({ token, invite }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [uiState, setUiState] = useState<UIState>("form");
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Accept the invite and go to dashboard
  async function acceptInviteAndRedirect(userId: string) {
    setUiState("accepting");
    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, userId }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Failed to accept invitation. Please try again.");
        setUiState("error");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setUiState("error");
    }
  }

  // On mount: check if user is already signed in + verified (e.g. returned from email link)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      if (user.email_confirmed_at) {
        // Already verified — auto-accept
        acceptInviteAndRedirect(user.id);
      } else {
        // Signed in but not yet verified — show waiting state
        setPendingUserId(user.id);
        setUiState("waiting");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for email verification in any tab
  useEffect(() => {
    if (uiState !== "waiting" || !pendingUserId) return;
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
          session?.user?.email_confirmed_at
        ) {
          subscription.unsubscribe();
          await acceptInviteAndRedirect(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState, pendingUserId]);

  async function handleResend() {
    if (!invite.email) return;
    setResendLoading(true);
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email: invite.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/invite/${token}`,
      },
    });
    setResendLoading(false);
    setResendSent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const strength = scorePassword(password);
    if (!strength.allowed) {
      setError("Please choose a stronger password before continuing.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const supabase = createClient();
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: { full_name: invite.name },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/invite/${token}`,
      },
    });

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        setError("An account with this email already exists. Please log in instead.");
      } else {
        setError(signUpError.message);
      }
      return;
    }

    if (!authData.user) {
      setError("Failed to create account. Please try again.");
      return;
    }

    // Check if they're immediately verified (email confirmations off, or already confirmed)
    if (authData.user.email_confirmed_at) {
      await acceptInviteAndRedirect(authData.user.id);
      return;
    }

    // Email confirmation required — show waiting state
    setPendingUserId(authData.user.id);
    setUiState("waiting");
  }

  // ── Waiting for email verification ─────────────────────────────
  if (uiState === "waiting") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-stone-900 mb-3">Check your inbox</h2>
          <p className="text-stone-500 text-sm mb-2">We sent a verification link to</p>
          <p className="font-semibold text-stone-900 text-sm mb-6">{invite.email}</p>
          <p className="text-stone-400 text-xs mb-8">
            Click the link in the email to verify your account. You&apos;ll be taken straight to your dashboard automatically.
          </p>

          <div className="flex items-center justify-center gap-2 text-stone-400 text-sm mb-8">
            <Loader2 size={16} className="animate-spin" />
            Waiting for verification…
          </div>

          {resendSent ? (
            <p className="text-xs text-emerald-700 font-medium">Verification email resent!</p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="text-sm text-stone-500 hover:text-stone-900 transition-colors underline underline-offset-2"
            >
              {resendLoading ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Accepting / setting up ─────────────────────────────────────
  if (uiState === "accepting") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-10 max-w-md w-full text-center">
          <Loader2 size={32} className="animate-spin text-stone-400 mx-auto mb-4" />
          <p className="text-stone-600 font-medium">Setting up your account…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────
  if (uiState === "error") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-stone-900 mb-3">Something went wrong</h2>
          <p className="text-stone-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => { setUiState("form"); setError(null); }}
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Signup form ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-stone-600 to-stone-700 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">N</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Join {invite.businessName}</h1>
          <p className="text-stone-500 text-sm">
            You&apos;ve been invited as a{" "}
            <span className="font-medium text-stone-700">{invite.role.replace("_", " ")}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Name</label>
            <input
              type="text"
              value={invite.name}
              disabled
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg bg-stone-50 text-stone-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
            <input
              type="email"
              value={invite.email}
              disabled
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg bg-stone-50 text-stone-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Create Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 12 characters"
                required
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <PasswordStrength password={password} className="mt-2" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] hover:from-[#4a4a4a] hover:to-[#2a2a2a] text-white font-medium py-3 rounded-full transition-all text-sm shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            Accept Invitation & Create Account
          </button>
        </form>

        <p className="text-center text-xs text-stone-400 mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-stone-700 hover:text-stone-900 font-medium">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
