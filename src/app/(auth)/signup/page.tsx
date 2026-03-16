"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gem } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
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
        <h2 className="text-xl font-semibold text-stone-900 mb-1">
          Start your free trial
        </h2>
        <p className="text-sm text-stone-400 mb-6">14 days free, no credit card required.</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              Your name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              Work email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@yourshop.com"
              className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
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
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 rounded-md border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors text-sm"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-xs text-stone-400 mt-4">
          By signing up you agree to our{" "}
          <a href="/terms" className="underline">Terms</a> and{" "}
          <a href="/privacy" className="underline">Privacy Policy</a>.
        </p>

        <p className="text-center text-sm text-stone-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-700 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
