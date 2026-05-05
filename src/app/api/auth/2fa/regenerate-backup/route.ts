import { withSentryFlush } from "@/lib/sentry-flush";
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateBackupCodes, hashBackupCode, verifyTOTPToken } from '@/lib/totp';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export const POST = withSentryFlush(async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate-limit keyed by user.id so a shared-IP neighbour can't DoS
    // the victim's backup-code-regen surface.
    const { success } = await checkRateLimit(user.id, 'auth');
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Pre-fix this route accepted a session-cookie-only request and
    // immediately returned a fresh backup-code list. A stolen-cookie
    // attacker could (a) lock out the legitimate user — their printed
    // backups stop working — and (b) recover an account-takeover route
    // for themselves. Disable now requires the current TOTP code; this
    // path now does too.
    const body = await request.json().catch(() => ({}));
    const token: string | undefined = body?.token;
    if (!token || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'A current 6-digit code from your authenticator app is required.' },
        { status: 400 },
      );
    }

    // Check if 2FA is enabled
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('totp_enabled, totp_secret')
      .eq('id', user.id)
      .single();

    if (!profile?.totp_enabled || !profile?.totp_secret) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
    }

    if (!verifyTOTPToken(token, profile.totp_secret)) {
      return NextResponse.json(
        { error: 'Invalid code — try again with a fresh code from your authenticator app.' },
        { status: 401 },
      );
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes(8);
    
    // Hash backup codes for storage
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => hashBackupCode(code))
    );

    // Update backup codes
    const { error: updateError } = await admin
      .from('users')
      .update({
        totp_backup_codes: hashedBackupCodes,
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to regenerate backup codes', { error: updateError });
      return NextResponse.json({ error: 'Failed to regenerate backup codes' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      backupCodes,
    });
  } catch (error) {
    logger.error('Backup code regeneration error', { error });
    return NextResponse.json(
      { error: 'Failed to regenerate backup codes' },
      { status: 500 }
    );
  }
});
