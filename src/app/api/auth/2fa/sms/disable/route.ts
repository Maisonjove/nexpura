import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTOTPToken } from '@/lib/totp';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await checkRateLimit(ip, 'auth');
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pre-fix this disable was session-cookie-only — a stolen cookie
    // could neutralise both factors at once (it also wiped
    // totp_backup_codes for users whose primary factor was TOTP, even
    // though only SMS was being disabled). Now: require a current
    // TOTP code (or in the future an SMS code) before tearing down.
    const body = await request.json().catch(() => ({}));
    const token: string | undefined = body?.token;
    if (!token || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'A current 6-digit code is required to disable SMS 2FA.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('totp_secret, totp_enabled, sms_2fa_enabled')
      .eq('id', user.id)
      .single();

    if (!profile?.sms_2fa_enabled) {
      return NextResponse.json({ success: true });
    }
    if (!profile?.totp_secret || !profile?.totp_enabled) {
      // No TOTP enrollment to verify against. Reject — re-enrollment
      // is the supported path here, not a bare-cookie disable.
      return NextResponse.json(
        { error: 'Disable from a logged-in browser with TOTP enrolled, or contact support.' },
        { status: 401 },
      );
    }
    if (!verifyTOTPToken(token, profile.totp_secret)) {
      return NextResponse.json(
        { error: 'Invalid code — try again with a fresh code from your authenticator app.' },
        { status: 401 },
      );
    }

    // Disable SMS 2FA only — never wipe totp_backup_codes here.
    // Backup codes belong to the TOTP factor and disabling SMS shouldn't
    // touch them.
    await admin
      .from('users')
      .update({
        sms_2fa_enabled: false,
        sms_2fa_phone: null,
        sms_2fa_phone_pending: null,
        sms_2fa_code: null,
        sms_2fa_code_expires_at: null,
      })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('SMS 2FA disable error', { error });
    return NextResponse.json(
      { error: 'Failed to disable SMS 2FA' },
      { status: 500 }
    );
  }
}
