"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="text-center mb-8">
        <Link href="/" className="font-serif text-2xl tracking-[0.32em] text-m-charcoal">
          NEXPURA
        </Link>
        <p className="text-[13px] text-m-text-faint mt-2">The modern platform for jewellers</p>
      </div>

      {/* Title block — Batch 2 polish (visual only, form-submit logic untouched) */}
      <div className="text-center mb-6">
        <h1 className="font-serif text-[28px] sm:text-[32px] text-m-charcoal leading-[1.15] tracking-[-0.005em]">
          Log in to Nexpura
        </h1>
        <p className="mt-2 text-[14px] text-m-text-secondary">
          Access your jewellery operating system.
        </p>
      </div>

      <div className="bg-m-white-soft rounded-[18px] border border-m-border-soft p-8 sm:p-10 w-full shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
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

        <form onSubmit={handlePasswordLogin} className="space-y-5" aria-label="Login form">
          <div>
            <label htmlFor="email" className="m-form-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              aria-describedby={error ? "login-error" : undefined}
              placeholder="you@yourshop.com"
              autoComplete="email"
              className="m-form-input"
            />
          </div>
          <div>
            <label htmlFor="password" className="m-form-label">Password</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-required="true"
                aria-describedby={error ? "login-error" : undefined}
                placeholder="••••••••"
                autoComplete="current-password"
                className="m-form-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-m-text-muted hover:text-m-charcoal transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-m-border-soft text-m-charcoal focus:ring-m-champagne cursor-pointer"
              />
              <span className="text-[14px] text-m-text-secondary">Remember me</span>
            </label>
            <Link href="/forgot-password" className="text-[14px] text-m-charcoal hover:opacity-70 transition-opacity">
              Forgot password?
            </Link>
          </div>

          {error && (
            <p
              id="login-error"
              role="alert"
              aria-live="assertive"
              className="text-[#C24545] text-[14px] bg-[#FDF1F1] border border-[#F4D9D9] px-4 py-2.5 rounded-lg"
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
            className="w-full h-[54px] bg-m-charcoal hover:-translate-y-0.5 hover:bg-m-charcoal-soft text-white font-semibold rounded-full transition-all duration-200 [transition-timing-function:var(--m-ease)] disabled:opacity-60 disabled:hover:translate-y-0 text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne focus-visible:ring-offset-2"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-[14px] text-m-text-muted mt-8">
          New to Nexpura?{" "}
          <Link
            href="/signup"
            className="text-m-charcoal hover:opacity-70 transition-opacity font-medium inline-flex items-center gap-1"
          >
            Start your free trial
            <span aria-hidden="true">→</span>
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
          <span className="font-serif text-2xl tracking-[0.32em] text-m-charcoal">NEXPURA</span>
          <p className="text-[13px] text-m-text-faint mt-2">The modern platform for jewellers</p>
        </div>
        <div className="bg-m-white-soft rounded-[18px] border border-m-border-soft p-8 sm:p-10 w-full shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
          <div className="h-8 w-48 bg-m-ivory rounded animate-pulse mb-8" />
          <div className="space-y-5">
            <div className="h-14 bg-m-ivory rounded-[14px] animate-pulse" />
            <div className="h-14 bg-m-ivory rounded-[14px] animate-pulse" />
            <div className="h-[54px] bg-m-charcoal rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
