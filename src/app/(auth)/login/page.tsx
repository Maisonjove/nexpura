"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gem } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email for the magic link!");
    }

    setLoading(false);
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
        <h2 className="text-xl font-semibold text-stone-900 mb-6">
          Welcome back
        </h2>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-stone-200 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("password"); setError(null); }}
            className={`flex-1 text-sm py-1.5 rounded-md transition-all ${
              mode === "password"
                ? "bg-amber-700 text-white font-medium"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMode("magic"); setError(null); }}
            className={`flex-1 text-sm py-1.5 rounded-md transition-all ${
              mode === "magic"
                ? "bg-amber-700 text-white font-medium"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Magic link
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@yourshop.com"
                className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 transition-colors text-sm"
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
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 transition-colors text-sm"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-md">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@yourshop.com"
                className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 transition-colors text-sm"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-md">{error}</p>
            )}
            {success && (
              <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-md">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-stone-500 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-amber-700 hover:underline font-medium">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
