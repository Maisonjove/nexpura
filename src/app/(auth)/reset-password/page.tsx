"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, Lock, Loader2 } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function checkSession() {
      // Implicit flow: Supabase redirects with #access_token=...&type=recovery in hash.
      // @supabase/ssr's createBrowserClient does NOT auto-process implicit flow hash tokens
      // (it uses PKCE/cookie-based auth by default). We must parse the hash manually and
      // call setSession() ourselves.
      if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            setIsValid(true);
            setValidating(false);
            return;
          }
        }
      }

      // PKCE flow: Supabase redirects with ?code=... as a query param
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setIsValid(true);
          setValidating(false);
          return;
        }
        setValidating(false);
        return;
      }

      // OTP/token_hash flow
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (!error) {
          setIsValid(true);
          setValidating(false);
          return;
        }
        setValidating(false);
        return;
      }

      // No token — check for existing session (e.g. navigated back after success)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) setIsValid(true);
      setValidating(false);
    }

    checkSession();
  }, [supabase, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 3000);
  }

  if (validating) {
    return (
      <div className="w-full max-w-md text-center">
        <Loader2 size={32} className="text-stone-400 animate-spin mx-auto mb-4" />
        <p className="text-stone-500">Validating reset link...</p>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="font-serif text-2xl tracking-[0.12em] text-stone-900">
            NEXPURA
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/60 p-10 w-full shadow-sm text-center">
          <h2 className="font-serif text-2xl text-stone-900 mb-3">Invalid or expired link</h2>
          <p className="text-stone-500 text-sm mb-8">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] text-white font-medium py-3 rounded-full text-sm shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="font-serif text-2xl tracking-[0.12em] text-stone-900">
            NEXPURA
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/60 p-10 w-full shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="font-serif text-2xl text-stone-900 mb-3">Password updated!</h2>
          <p className="text-stone-500 text-sm">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-10">
        <Link href="/" className="font-serif text-2xl tracking-[0.12em] text-stone-900">
          NEXPURA
        </Link>
        <p className="text-sm text-stone-400 mt-2">The modern platform for jewellers</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/60 p-10 w-full shadow-sm">
        <h2 className="font-serif text-2xl text-stone-900 mb-2">Set new password</h2>
        <p className="text-stone-500 text-sm mb-8">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
              New password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                placeholder="At least 12 characters"
                className="w-full pl-11 pr-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
              Confirm password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat your password"
                className="w-full pl-11 pr-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-2.5 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] hover:from-[#4a4a4a] hover:to-[#2a2a2a] text-white font-medium py-3 rounded-full transition-all disabled:opacity-60 text-sm shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md text-center">
          <Loader2 size={32} className="text-stone-400 animate-spin mx-auto mb-4" />
          <p className="text-stone-500">Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
