import { withSentryFlush } from "@/lib/sentry-flush";
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTOTPSecret, generateTOTPQRCode } from '@/lib/totp';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export const POST = withSentryFlush(async (request: NextRequest) => {
  void request; // ip-keyed rate-limit replaced with user-id below
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pre-fix this rate-limited by IP — a NAT/CGNAT neighbour could DoS
    // a victim's 2FA setup attempts. Other 2FA routes (verify, disable)
    // correctly key by user.id; align this one.
    const { success } = await checkRateLimit(user.id, 'auth');
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Get user email
    const { data: profile } = await supabase
      .from('users')
      .select('email, totp_enabled')
      .eq('id', user.id)
      .single();

    if (profile?.totp_enabled) {
      return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 });
    }

    const email = profile?.email || user.email || '';

    // Generate new secret
    const secret = generateTOTPSecret();

    // Pre-fix this just returned the secret to the client and trusted
    // whatever secret /verify received in its body — an attacker who
    // controlled the user's browser at enrollment could substitute a
    // secret they know and read the user's TOTP for life. Now: persist
    // the candidate secret server-side bound to the user.id with a
    // timestamp; /verify pulls from there and ignores the body's
    // secret. Migration 20260425d_totp_pending_secret.
    const admin = createAdminClient();
    await admin
      .from('users')
      .update({
        totp_pending_secret: secret,
        totp_pending_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Generate QR code (still returned so the user's authenticator app
    // can enroll the same secret). The secret is also returned for the
    // manual-entry fallback UI; that's acceptable because /verify no
    // longer trusts what the client posts back.
    const qrCode = await generateTOTPQRCode(secret, email, 'Nexpura');

    return NextResponse.json({
      secret,
      qrCode,
    });
  } catch (error) {
    logger.error('2FA setup error', { error });
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
});
