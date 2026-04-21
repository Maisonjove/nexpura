import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTOTPToken, verifyBackupCode } from '@/lib/totp';
import { recordSession, checkNewDeviceLogin } from '@/lib/session-manager';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { twoFAValidateSchema } from '@/lib/schemas';
import { setTwoFactorCookie } from '@/lib/auth/two-factor-cookie';

/**
 * Validate a 2FA code during login
 * This is called after successful password authentication
 * 
 * SECURITY: Requires an active session (from password login) to prevent
 * oracle attacks where an attacker could validate 2FA codes without knowing the password.
 */
export async function POST(request: NextRequest) {
  // Strict rate limiting for auth endpoints
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success: rlSuccess } = await checkRateLimit(ip, 'auth');
  if (!rlSuccess) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    // SECURITY: Verify the caller has an active session
    // This ensures they passed password authentication before attempting 2FA
    const supabase = await createClient();
    const { data: { user: sessionUser } } = await supabase.auth.getUser();
    
    if (!sessionUser) {
      // No session means they haven't passed password auth
      return NextResponse.json({ error: 'Session required' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = twoFAValidateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { userId, code } = parseResult.data;

    // SECURITY: Verify the userId matches the session user
    // Prevents validating 2FA for a different user
    if (userId !== sessionUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const admin = createAdminClient();
    
    // Get user's 2FA settings
    const { data: profile, error: fetchError } = await admin
      .from('users')
      .select('totp_secret, totp_enabled, totp_backup_codes')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!profile.totp_enabled || !profile.totp_secret) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
    }

    // Try TOTP code first
    const normalizedCode = code.replace(/\s/g, '').toUpperCase();

    const host = request.headers.get('host') || undefined;
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const protocol = forwardedProto ? `${forwardedProto}:` : undefined;

    // Check if it's a 6-digit TOTP code
    if (/^\d{6}$/.test(normalizedCode)) {
      const isValid = verifyTOTPToken(normalizedCode, profile.totp_secret);

      if (isValid) {
        // Record session after successful 2FA (non-blocking, isolated)
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const reqHeaders = {
              ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
              userAgent: request.headers.get('user-agent') || 'unknown'
            };
            recordSession(userId, session.access_token, reqHeaders).catch(() => {});
            checkNewDeviceLogin(userId, sessionUser.email || '', reqHeaders).catch(() => {});
          }
        } catch {
          // Silently ignore - session tracking is non-critical
        }
        // PR-05: mint the HMAC-signed cookie that middleware requires for
        // any totp_enabled user. Without it the user will be bounced back
        // to /verify-2fa on their next navigation. If the signing secret
        // is unset in this environment, fail-closed: return an explicit
        // 500 rather than a cosmetic success that lets the bearer roam.
        const res = NextResponse.json({ valid: true, method: 'totp' });
        const ok = setTwoFactorCookie(res, userId, host, protocol);
        if (!ok) {
          logger.error('2FA cookie signing unavailable — refusing AAL2 promotion', { userId });
          return NextResponse.json(
            { error: '2FA is temporarily unavailable, please contact support.' },
            { status: 500 }
          );
        }
        return res;
      }
    }

    // Try backup code (8 alphanumeric characters)
    if (/^[A-Z0-9]{8}$/.test(normalizedCode) && profile.totp_backup_codes) {
      const { valid, usedIndex } = await verifyBackupCode(
        normalizedCode,
        profile.totp_backup_codes
      );

      if (valid) {
        // Mark the backup code as used by setting it to null
        const updatedCodes = [...profile.totp_backup_codes];
        updatedCodes[usedIndex] = null;

        await admin
          .from('users')
          .update({ totp_backup_codes: updatedCodes })
          .eq('id', userId);

        // Record session after successful 2FA (non-blocking, isolated)
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const reqHeaders = {
              ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
              userAgent: request.headers.get('user-agent') || 'unknown'
            };
            recordSession(userId, session.access_token, reqHeaders).catch(() => {});
            checkNewDeviceLogin(userId, sessionUser.email || '', reqHeaders).catch(() => {});
          }
        } catch {
          // Silently ignore - session tracking is non-critical
        }

        // PR-05: see the TOTP branch above — mint the AAL2 cookie or fail-closed.
        const res = NextResponse.json({ valid: true, method: 'backup_code' });
        const ok = setTwoFactorCookie(res, userId, host, protocol);
        if (!ok) {
          logger.error('2FA cookie signing unavailable — refusing AAL2 promotion', { userId });
          return NextResponse.json(
            { error: '2FA is temporarily unavailable, please contact support.' },
            { status: 500 }
          );
        }
        return res;
      }
    }

    return NextResponse.json({ valid: false, error: 'Invalid code' }, { status: 400 });
  } catch (error) {
    logger.error('2FA validation error', { error });
    return NextResponse.json(
      { error: 'Failed to validate 2FA' },
      { status: 500 }
    );
  }
}
