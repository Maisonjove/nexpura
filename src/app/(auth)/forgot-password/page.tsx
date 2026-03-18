"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Gem, ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
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
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-10 w-full shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Check your email
          </h2>
          <p className="text-stone-500 text-sm mb-6">
            We&apos;ve sent a password reset link to <strong>{email}</strong>
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>
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
          Forgot your password?
        </h2>
        <p className="text-stone-500 text-sm mb-6">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@yourshop.com"
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
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-stone-500 hover:text-stone-700 text-sm mt-6"
        >
          <ArrowLeft size={16} />
          Back to login
        </Link>
      </div>
    </div>
  );
}
