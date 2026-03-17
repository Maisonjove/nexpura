"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gem, Shield, Lock } from "lucide-react";

const OWNER_EMAIL = "germanijoey@yahoo.com";

export default function OwnerAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // First, sign in with Supabase
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Check if the email is the owner email
    if (data.user?.email !== OWNER_EMAIL) {
      // Sign them out immediately
      await supabase.auth.signOut();
      setError("Access denied. This portal is restricted to platform owner only.");
      setLoading(false);
      return;
    }

    // Success - redirect to owner dashboard
    router.push("/owner-admin/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-500/30 mb-4">
            <Gem size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white mt-4">Owner Portal</h1>
          <p className="text-stone-400 mt-2 text-sm">
            Nexpura Platform Administration
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Shield size={16} className="text-amber-500" />
            <span className="text-xs text-amber-400">Restricted access — Owner only</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="owner@nexpura.com"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-sm"
                />
                <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500" />
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-60 text-sm shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                "Sign in to Owner Portal"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-stone-500 mt-6">
          This portal is for platform administration only.
          <br />
          Regular users should use{" "}
          <a href="/login" className="text-amber-500 hover:underline">
            the main login
          </a>
          .
        </p>
      </div>
    </div>
  );
}
