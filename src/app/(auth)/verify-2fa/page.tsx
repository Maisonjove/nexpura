'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Gem, ShieldCheck, Key, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function Verify2FAContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = searchParams.get('userId');
  const email = searchParams.get('email');

  useEffect(() => {
    // If no userId, redirect to login
    if (!userId) {
      router.push('/login');
    }
  }, [userId, router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    
    if (!userId) return;
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          code: code.replace(/\s/g, ''),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // 2FA verified - complete login by refreshing auth state
      const supabase = createClient();
      await supabase.auth.refreshSession();

      // Mark 2FA as verified in session storage
      sessionStorage.setItem('2fa_verified', 'true');

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  if (!userId) {
    return null;
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
        <p className="text-sm text-stone-400">Two-Factor Authentication</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-10 w-full shadow-sm">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            {useBackupCode ? (
              <Key className="h-8 w-8 text-amber-700" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-amber-700" />
            )}
          </div>
        </div>

        <h2 className="text-xl font-semibold text-stone-900 text-center mb-2">
          {useBackupCode ? 'Enter Backup Code' : 'Enter Verification Code'}
        </h2>
        <p className="text-sm text-stone-500 text-center mb-6">
          {useBackupCode 
            ? 'Enter one of your backup codes to sign in'
            : `Enter the 6-digit code from your authenticator app${email ? ` for ${email}` : ''}`
          }
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            {useBackupCode ? (
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="XXXXXXXX"
                maxLength={8}
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                autoFocus
                autoComplete="one-time-code"
              />
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (useBackupCode ? code.length !== 8 : code.length !== 6)}
            className="w-full bg-amber-700 hover:bg-amber-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              setError(null);
            }}
            className="text-sm text-amber-700 hover:underline"
          >
            {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-stone-100 text-center">
          <Link href="/login" className="text-sm text-stone-500 hover:text-stone-700">
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
          <div className="h-12 bg-stone-200 rounded" />
          <div className="h-64 bg-stone-200 rounded" />
        </div>
      </div>
    }>
      <Verify2FAContent />
    </Suspense>
  );
}
