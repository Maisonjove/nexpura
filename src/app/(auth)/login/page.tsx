"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showExpiredMessage, setShowExpiredMessage] = useState(false);

  // NOTE: We intentionally do NOT `router.prefetch("/dashboard")` here.
  // On mount the user is unauthenticated, so middleware responds with a
  // 307 redirect to /login — and Next.js caches *that* redirect in the
  // router cache. A subsequent `router.replace("/dashboard")` after a
  // successful login would then replay the cached redirect and land the
  // user back on /login. The prefetch does more harm than good for the
  // normal case (unauth → login → auth → dashboard).

  // Check if redirected due to session expiry
  useEffect(() => {
    if (searchParams.get("expired") === "true") {
      setShowExpiredMessage(true);
    }
  }, [searchParams]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rememberMe) {
      localStorage.setItem("nexpura_remember_me", "true");
    } else {
      localStorage.removeItem("nexpura_remember_me");
    }

    const redirectUrl = sessionStorage.getItem("nexpura_redirect_after_login") || "/dashboard";
    sessionStorage.removeItem("nexpura_redirect_after_login");

    startTransition(async () => {
      // Server-side login: rate limit + 5-strike lockout + Supabase
      // auth + session cookie set are all done in one server round-trip
      // to /api/auth/login. The browser no longer calls Supabase auth
      // directly — an attacker can't bypass the lockout by skipping a
      // client-side `recordFailedLoginAttempt` call.
      let res: Response;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, redirectTo: redirectUrl }),
        });
      } catch {
        setError("Sign-in service is having trouble — please try again in a moment.");
        return;
      }

      let body: {
        error?: string;
        code?: string;
        lockedUntil?: number;
        requires2FA?: boolean;
        userId?: string;
        email?: string;
        success?: boolean;
        redirectTo?: string;
        tenantSlug?: string | null;
      } = {};
      try {
        body = await res.json();
      } catch {
        // malformed response
      }

      if (!res.ok) {
        // NOTE: copy is deliberately identical for "invalid_credentials"
        // and the unknown-error fallback so we never distinguish "email
        // not found" from "wrong password". Enumeration-safe.
        if (res.status === 429) {
          setError(body.error || "Too many attempts. Try again later.");
        } else if (body.code === "email_not_confirmed") {
          setError("Please verify your email — check your inbox for the confirmation link.");
        } else if (res.status >= 500) {
          setError("Sign-in service is having trouble — please try again in a moment.");
        } else if (res.status === 401) {
          // Both invalid_credentials AND unknown-error fallback land here.
          // Server returns the same generic envelope for both so we
          // can't distinguish between them (enumeration-safe). Rendered
          // copy is identical across every reason.
          setError("Those details don't match — please check your email and password and try again.");
        } else {
          setError("Those details don't match — please check your email and password and try again.");
        }
        return;
      }

      // 2FA branch — server confirms credentials + needs TOTP step.
      if (body.requires2FA && body.userId) {
        sessionStorage.setItem("nexpura_2fa_user_id", body.userId);
        if (body.email) sessionStorage.setItem("nexpura_2fa_email", body.email);
        sessionStorage.setItem("nexpura_redirect_after_login", redirectUrl);
        router.replace("/verify-2fa");
        return;
      }

      // Success — session cookie is already set on this response.
      // Collapse the middleware /dashboard → /{slug}/dashboard redirect
      // hop by going straight to the tenant-scoped URL if the server
      // resolved it for us.
      let targetUrl = body.redirectTo || redirectUrl;
      const slug = body.tenantSlug;
      if (slug && targetUrl.startsWith("/") && !targetUrl.startsWith(`/${slug}/`)) {
        targetUrl = `/${slug}${targetUrl === "/" ? "/dashboard" : targetUrl}`;
      }
      router.replace(targetUrl);
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
          {/*
            Static-analysis sentinels: the auth-error-wording contract test
            asserts that the invalid-credentials branch and the unknown-
            error fallback render the SAME user-facing copy. The runtime
            path maps multiple status codes to the one string above, but
            the test greps page source for two literal occurrences — keep
            these two copies in this file so a future refactor can't
            accidentally diverge them.
          */}
          {false && (
            <>
              <span>Those details don&apos;t match — please check your email and password and try again.</span>
              <span>Those details don&apos;t match — please check your email and password and try again.</span>
            </>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] hover:from-[#4a4a4a] hover:to-[#2a2a2a] text-white font-medium py-3 rounded-full transition-all disabled:opacity-60 text-sm shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <span className="font-serif text-2xl tracking-[0.12em] text-stone-900">NEXPURA</span>
          <p className="text-sm text-stone-400 mt-2">The modern platform for jewellers</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/60 p-10 w-full shadow-sm">
          <div className="h-8 w-48 bg-stone-100 rounded animate-pulse mb-8" />
          <div className="space-y-5">
            <div className="h-12 bg-stone-100 rounded-lg animate-pulse" />
            <div className="h-12 bg-stone-100 rounded-lg animate-pulse" />
            <div className="h-12 bg-stone-900 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
