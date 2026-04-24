'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, Key, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function Verify2FAContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userIdParam = searchParams.get('userId');
  const emailParam = searchParams.get('email');
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(userIdParam);
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(emailParam);

  const rawReturnTo = searchParams.get('returnTo');
  // Defence-in-depth: only honour same-origin relative paths. If the
  // middleware redirects a user here it supplies returnTo already URL-
  // decoded by Next.js. A tampered querystring like
  // `?returnTo=https://evil.example/phish` would otherwise become a
  // post-2FA open-redirect. Reject anything that isn't a path starting
  // with a single `/` (and not `//` protocol-relative).
  const returnTo =
    rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//')
      ? rawReturnTo
      : '/dashboard';

  // PR-05: middleware can redirect an already-authenticated but un-
  // promoted user here without the legacy ?userId= param. In that case
  // probe /api/auth/me to pick up the identity from the Supabase session
  // cookie. If there's no session at all, bounce to /login.
  useEffect(() => {
    if (userIdParam) return; // legacy login-flow already supplied it
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json().catch(() => null);
        if (!data?.userId) {
          router.push('/login');
          return;
        }
        setResolvedUserId(data.userId);
        if (data.email) setResolvedEmail(data.email);
      })
      .catch(() => {
        if (!cancelled) router.push('/login');
      });
    return () => {
      cancelled = true;
    };
  }, [userIdParam, router]);

  const userId = resolvedUserId;
  const email = resolvedEmail;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: code.replace(/\s/g, '') }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        // Human-friendly copy for invalid code. We intentionally do NOT
        // distinguish "user doesn't have 2FA enabled" vs "wrong code" —
        // both funnel to the same message so an attacker can't probe
        // account-state from this page.
        throw new Error(
          "That code didn't match — try again, or use a backup code if the app is out of sync."
        );
      }

      const supabase = createClient();
      await supabase.auth.refreshSession();
      sessionStorage.setItem('2fa_verified', 'true');

      // PR-05: respect the sanitized returnTo so middleware-initiated
      // redirects land the user back where they were trying to go, not
      // on a forced /dashboard.
      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't verify that code — please try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!userId) return null;

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-10">
        <Link href="/" className="font-serif text-2xl tracking-[0.12em] text-stone-900">
          NEXPURA
        </Link>
        <p className="text-sm text-stone-400 mt-2">Two-Factor Authentication</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/60 p-10 w-full shadow-sm">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
            {useBackupCode ? (
              <Key className="h-8 w-8 text-stone-600" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-stone-600" />
            )}
          </div>
        </div>

        <h2 className="font-serif text-2xl text-stone-900 text-center mb-2">
          {useBackupCode ? 'Enter Backup Code' : 'Enter Verification Code'}
        </h2>
        <p className="text-sm text-stone-500 text-center mb-8">
          {useBackupCode
            ? 'Enter one of your backup codes to sign in'
            : `Enter the 6-digit code from your authenticator app${email ? ` for ${email}` : ''}`
          }
        </p>

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            {useBackupCode ? (
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="XXXXXXXX"
                maxLength={8}
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900"
                autoFocus
                autoComplete="off"
              />
            ) : (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900"
                autoFocus
                autoComplete="one-time-code"
              />
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-lg px-4 py-2.5 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (useBackupCode ? code.length !== 8 : code.length !== 6)}
            className="w-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] hover:from-[#4a4a4a] hover:to-[#2a2a2a] text-white font-medium py-3 rounded-full transition-all disabled:opacity-50 text-sm shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              setError(null);
            }}
            className="text-sm text-stone-900 hover:opacity-70 transition-opacity"
          >
            {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-stone-100 text-center">
          <Link href="/login" className="text-sm text-stone-400 hover:text-stone-700 transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-stone-100 rounded" />
          <div className="h-64 bg-stone-100 rounded" />
        </div>
      </div>
    }>
      <Verify2FAContent />
    </Suspense>
  );
}
