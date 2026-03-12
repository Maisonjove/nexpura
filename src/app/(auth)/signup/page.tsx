"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
        <h1 className="font-fraunces text-3xl font-semibold text-forest">
          Nexpura
        </h1>
        <p className="text-sm text-forest/60 mt-1">Cloud OS for Jewellery Businesses</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-platinum p-8">
        <h2 className="font-fraunces text-xl font-semibold text-forest mb-2">
          Start your free trial
        </h2>
        <p className="text-sm text-forest/60 mb-6">14 days free, no credit card required.</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-forest mb-1">
              Your name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full px-3 py-2.5 rounded-lg border border-platinum bg-ivory text-forest placeholder-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest mb-1">
              Work email
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
              minLength={8}
              placeholder="At least 8 characters"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-xs text-forest/40 mt-4">
          By signing up you agree to our{" "}
          <a href="#" className="underline">Terms</a> and{" "}
          <a href="#" className="underline">Privacy Policy</a>.
        </p>

        <p className="text-center text-sm text-forest/60 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-sage hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
