"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginAction } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showExpiredMessage, setShowExpiredMessage] = useState(false);
  
  // Prefetch dashboard on mount so navigation is instant after login
  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  // Check if redirected due to session expiry
  useEffect(() => {
    if (searchParams.get("expired") === "true") {
      setShowExpiredMessage(true);
    }
  }, [searchParams]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loginAction(email, password);

      if (!result.success) {
        setError(result.error || "Login failed");
        return;
      }

      if (result.requires2FA && result.userId && result.email) {
        router.push(`/verify-2fa?userId=${result.userId}&email=${encodeURIComponent(result.email)}`);
        return;
      }

      if (rememberMe) {
        localStorage.setItem("nexpura_remember_me", "true");
      } else {
        localStorage.removeItem("nexpura_remember_me");
      }

      // Flush the new session into middleware before navigating (Supabase SSR + App Router)
      await router.refresh();

      // Check if there's a redirect URL from session expiry
      const redirectUrl = sessionStorage.getItem("nexpura_redirect_after_login");
      if (redirectUrl) {
        sessionStorage.removeItem("nexpura_redirect_after_login");
        router.push(redirectUrl);
      } else {
        router.push("/dashboard");
      }
    });
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-10">
        <Link href="/" className="font-serif text-2xl tracking-[0.12em] text-stone-900">
          NEXPURA
        </Link>
        <p className="text-sm text-stone-400 mt-2">The modern platform for jewellers</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/60 p-10 w-full shadow-sm">
        {/* Session expired message */}
        {showExpiredMessage && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Session expired</p>
                <p className="text-sm text-amber-700 mt-1">Please log in again to continue where you left off.</p>
              </div>
            </div>
          </div>
        )}
        
        <h2 className="font-serif text-2xl text-stone-900 mb-8">
          Welcome back
        </h2>

        <form onSubmit={handlePasswordLogin} className="space-y-5" aria-label="Login form">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              aria-describedby={error ? "login-error" : undefined}
              placeholder="you@yourshop.com"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              aria-describedby={error ? "login-error" : undefined}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900/20 cursor-pointer"
              />
              <span className="text-sm text-stone-500">Remember me</span>
            </label>
            <Link href="/forgot-password" className="text-sm text-stone-900 hover:opacity-70 transition-opacity">
              Forgot password?
            </Link>
          </div>

          {error && (
            <p
              id="login-error"
              role="alert"
              aria-live="assertive"
              className="text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-2.5 rounded-lg"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] hover:from-[#4a4a4a] hover:to-[#2a2a2a] text-white font-medium py-3 rounded-full transition-all disabled:opacity-60 text-sm shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-100" />
          </div>
          <div className="relative flex justify-center text-xs text-stone-400 bg-white px-4">
            or continue with
          </div>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${window.location.origin}/auth/callback`,
              },
            });
          }}
          className="w-full flex items-center justify-center gap-3 border border-stone-200 rounded-full py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          aria-label="Sign in with Google"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
            <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
            <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
            <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-sm text-stone-400 mt-8">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-stone-900 hover:opacity-70 transition-opacity font-medium">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
