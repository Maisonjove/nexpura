"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
        <h1 className="font-fraunces text-3xl font-semibold text-forest">
          Nexpura
        </h1>
        <p className="text-sm text-forest/60 mt-1">Cloud OS for Jewellery Businesses</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-platinum p-8">
        <h2 className="font-fraunces text-xl font-semibold text-forest mb-6">
          Welcome back
        </h2>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-platinum p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("password"); setError(null); }}
            className={`flex-1 text-sm py-1.5 rounded-md transition-all ${
              mode === "password"
                ? "bg-forest text-white font-medium"
                : "text-forest/60 hover:text-forest"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMode("magic"); setError(null); }}
            className={`flex-1 text-sm py-1.5 rounded-md transition-all ${
              mode === "magic"
                ? "bg-forest text-white font-medium"
                : "text-forest/60 hover:text-forest"
            }`}
          >
            Magic link
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-forest mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@yourshop.com"
                className="w-full px-3 py-2.5 rounded-lg border border-platinum bg-ivory text-forest placeholder-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg border border-platinum bg-ivory text-forest placeholder-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage transition-colors text-sm"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sage hover:bg-sage/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-forest mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@yourshop.com"
                className="w-full px-3 py-2.5 rounded-lg border border-platinum bg-ivory text-forest placeholder-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage transition-colors text-sm"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            {success && (
              <p className="text-sage text-sm bg-sage/10 px-3 py-2 rounded-lg">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full bg-sage hover:bg-sage/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-forest/60 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-sage hover:underline font-medium">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
