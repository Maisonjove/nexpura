"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gem, CheckCircle, Lock, Loader2 } from "lucide-react";

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
    // Check if we have a valid reset session
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValid(true);
      }
      setValidating(false);
    }
    checkSession();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
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

    // Redirect to login after 3 seconds
    setTimeout(() => {
      router.push("/login");
    }, 3000);
  }

  if (validating) {
    return (
      <div className="w-full max-w-md text-center">
        <Loader2 size={32} className="text-amber-600 animate-spin mx-auto mb-4" />
        <p className="text-stone-500">Validating reset link...</p>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-700 flex items-center justify-center">
              <Gem size={18} color="white" />
            </div>
            <span className="text-xl font-semibold text-stone-900">Nexpura</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-10 w-full shadow-sm text-center">
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Invalid or expired link
          </h2>
          <p className="text-stone-500 text-sm mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center w-full bg-amber-700 hover:bg-amber-800 text-white font-medium py-2.5 rounded-md transition-colors text-sm"
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
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-700 flex items-center justify-center">
              <Gem size={18} color="white" />
            </div>
            <span className="text-xl font-semibold text-stone-900">Nexpura</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-10 w-full shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Password updated!
          </h2>
          <p className="text-stone-500 text-sm">
            Redirecting you to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
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

      <div className="bg-white rounded-xl border border-stone-200 p-10 w-full shadow-sm">
        <h2 className="text-xl font-semibold text-stone-900 mb-2">
          Set new password
        </h2>
        <p className="text-stone-500 text-sm mb-6">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              New password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 transition-colors text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              Confirm password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat your password"
                className="w-full pl-10 pr-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 transition-colors text-sm"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-700 hover:bg-amber-800 text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60 text-sm"
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
          <Loader2 size={32} className="text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-stone-500">Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
