'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, Smartphone, Copy, Check, AlertTriangle, ArrowLeft, Key, Trash2 } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';

type TwoFactorState = 'loading' | 'disabled' | 'setup-totp' | 'enabled-totp' | 'backup-codes';

export default function TwoFactorSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [state, setState] = useState<TwoFactorState>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remainingBackupCodes, setRemainingBackupCodes] = useState(0);

  useEffect(() => {
    checkTwoFactorStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkTwoFactorStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('totp_enabled, totp_backup_codes')
        .eq('id', user.id)
        .single();

      if (profile?.totp_enabled) {
        const backupCodesArr = profile.totp_backup_codes || [];
        setRemainingBackupCodes(backupCodesArr.filter((c: string | null) => c !== null).length);
        setState('enabled-totp');
      } else {
        setState('disabled');
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: '2fa-status-check' } });
      setState('disabled');
    }
  }

  async function handleSetupTOTP() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to setup 2FA');
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setState('setup-totp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyTOTP() {
    if (verifyCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode, secret }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      setBackupCodes(data.backupCodes);
      setState('backup-codes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/disable', { method: 'POST' });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to disable 2FA');
      }

      setState('disabled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerateBackupCodes() {
    if (!confirm('This will invalidate your existing backup codes. Continue?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/regenerate-backup', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate backup codes');
      }

      setBackupCodes(data.backupCodes);
      setRemainingBackupCodes(data.backupCodes.length);
      setState('backup-codes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, type: 'secret' | 'backup') {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
    }
  }

  if (state === 'loading') {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-48" />
          <div className="h-64 bg-stone-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Two-Factor Authentication</h1>
            <p className="text-sm text-stone-500">Add an extra layer of security to your account</p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Disabled state — single CTA to start TOTP enrolment */}
      {state === 'disabled' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Recommended for all accounts</p>
                <p className="text-sm text-amber-700 mt-1">
                  Two-factor authentication significantly reduces the risk of unauthorized access to your account.
                </p>
              </div>
            </div>
          </div>

          {/* Authenticator App — only supported method */}
          <button
            onClick={handleSetupTOTP}
            disabled={loading}
            className="w-full bg-white rounded-xl border border-stone-200 p-6 hover:border-amber-300 hover:shadow-sm transition-all text-left disabled:opacity-50"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <h2 className="font-semibold text-stone-900 mb-1">Authenticator App</h2>
                <p className="text-sm text-stone-500">
                  Use Google Authenticator, Authy, or 1Password to generate codes
                </p>
                <span className="inline-block mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Most secure
                </span>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Setup TOTP - show QR code */}
      {state === 'setup-totp' && qrCode && secret && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="font-semibold text-stone-900 mb-4">1. Scan QR Code</h2>
          <p className="text-sm text-stone-500 mb-4">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
          </p>

          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
            </div>
          </div>

          <div className="bg-stone-50 rounded-lg p-4 mb-6">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
              Or enter this code manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border border-stone-200 text-sm font-mono text-stone-900 break-all">
                {secret}
              </code>
              <button
                onClick={() => copyToClipboard(secret, 'secret')}
                className="p-2 hover:bg-stone-200 rounded transition-colors"
                title="Copy secret"
              >
                {copiedSecret ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-stone-500" />
                )}
              </button>
            </div>
          </div>

          <h2 className="font-semibold text-stone-900 mb-4">2. Verify Code</h2>
          <p className="text-sm text-stone-500 mb-4">
            Enter the 6-digit code from your authenticator app to verify setup.
          </p>

          <div className="mb-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-amber-500"
              autoComplete="one-time-code"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setState('disabled');
                setQrCode(null);
                setSecret(null);
                setVerifyCode('');
              }}
              className="flex-1 px-4 py-2.5 border border-stone-200 text-stone-700 font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleVerifyTOTP}
              disabled={loading || verifyCode.length !== 6}
              className="flex-1 bg-nexpura-charcoal text-white font-medium py-2.5 rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </div>
        </div>
      )}

      {/* Backup codes state */}
      {state === 'backup-codes' && backupCodes.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Two-Factor Authentication Enabled</h2>
              <p className="text-sm text-stone-500 mt-1">Save your backup codes in a secure location</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Save these backup codes</p>
                <p className="text-sm text-amber-700 mt-1">
                  These codes can be used to access your account if you lose your authenticator device.
                  Each code can only be used once.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-stone-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <code key={i} className="bg-white px-3 py-2 rounded border border-stone-200 text-sm font-mono text-stone-900 text-center">
                  {code}
                </code>
              ))}
            </div>
          </div>

          <button
            onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-stone-200 text-stone-700 font-medium rounded-lg hover:bg-stone-50 transition-colors mb-6"
          >
            {copiedBackup ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy All Codes
              </>
            )}
          </button>

          <button
            onClick={() => {
              setBackupCodes([]);
              checkTwoFactorStatus();
            }}
            className="w-full bg-nexpura-charcoal text-white font-medium py-2.5 rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
          >
            I&apos;ve Saved My Codes
          </button>
        </div>
      )}

      {/* Enabled TOTP state */}
      {state === 'enabled-totp' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-stone-900">Two-Factor Authentication is Enabled</h2>
                <p className="text-sm text-stone-500 mt-1">
                  Your account is protected with an authenticator app.
                </p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Using authenticator app
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Key className="h-5 w-5 text-stone-600" />
              </div>
              <div>
                <h3 className="font-medium text-stone-900">Backup Codes</h3>
                <p className="text-sm text-stone-500 mt-0.5">
                  {remainingBackupCodes} of 8 backup codes remaining
                </p>
              </div>
            </div>

            <button
              onClick={handleRegenerateBackupCodes}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-stone-200 text-stone-700 font-medium rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              <Key className="h-4 w-4" />
              {loading ? 'Generating...' : 'Generate New Backup Codes'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-red-200 p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium text-stone-900">Disable Two-Factor Authentication</h3>
                <p className="text-sm text-stone-500 mt-0.5">
                  This will make your account less secure
                </p>
              </div>
            </div>

            <button
              onClick={handleDisable}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
