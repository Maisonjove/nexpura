import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTOTPToken } from '@/lib/totp';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { clearTwoFactorCookie } from '@/lib/auth/two-factor-cookie';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate-limit keyed by user.id so a shared-IP neighbour can't DoS
    // the victim's 2FA-disable surface.
    const { success: rlOk } = await checkRateLimit(user.id, 'auth');
    if (!rlOk) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Proof-of-possession: require a current TOTP code before disabling.
    // Disabling 2FA is a high-value target (it clears backup codes too),
    // so we don't let a session-cookie-only request succeed — the user
    // must prove they hold the current authenticator. CSRF is already
    // enforced by middleware (2fa/disable is no longer blanket-exempt).
    const body = await request.json().catch(() => ({} as { token?: string }));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'Current 6-digit code required' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('totp_secret, totp_enabled')
      .eq('id', user.id)
      .single();
    if (!profile?.totp_enabled || !profile?.totp_secret) {
      // 2FA is already off — idempotent success (no info leak).
      return NextResponse.json({ success: true });
    }
    const codeOk = verifyTOTPToken(profile.totp_secret, token);
    if (!codeOk) {
      return NextResponse.json(
        { error: 'Invalid code — try again with a fresh code from your authenticator app.' },
        { status: 401 },
      );
    }

    // Disable 2FA using admin client to bypass RLS
    const { error: updateError } = await admin
      .from('users')
      .update({
        totp_secret: null,
        totp_enabled: false,
        totp_backup_codes: null,
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to disable 2FA', { error: updateError });
      return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 });
    }

    // PR-05: clear the 2FA proof cookie — no longer meaningful once the
    // factor is disabled, and guarantees that if 2FA is re-enabled later
    // the user must re-prove possession before the middleware trusts them.
    const host = request.headers.get('host') || undefined;
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const protocol = forwardedProto ? `${forwardedProto}:` : undefined;
    const res = NextResponse.json({ success: true });
    clearTwoFactorCookie(res, host, protocol);
    return res;
  } catch (error) {
    logger.error('2FA disable error', { error });
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
