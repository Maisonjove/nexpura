import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTOTPToken, generateBackupCodes, hashBackupCode } from '@/lib/totp';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { twoFAVerifySchema } from '@/lib/schemas';
import { setTwoFactorCookie } from '@/lib/auth/two-factor-cookie';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit keyed by user.id so a victim's 2FA-setup attempts
    // can't be DoS'd by an attacker sharing their IP (NAT / CGNAT).
    const { success: rlSuccess } = await checkRateLimit(user.id, 'auth');
    if (!rlSuccess) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const parseResult = twoFAVerifySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { code, secret } = parseResult.data;

    // Verify the TOTP code
    const isValid = verifyTOTPToken(code, secret);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(8);
    
    // Hash backup codes for storage
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => hashBackupCode(code))
    );

    // Save to database using admin client to bypass RLS
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('users')
      .update({
        totp_secret: secret,
        totp_enabled: true,
        totp_backup_codes: hashedBackupCodes,
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to enable 2FA', { error: updateError });
      return NextResponse.json({ error: 'Failed to enable 2FA' }, { status: 500 });
    }

    // PR-05: the user just proved possession of the TOTP factor during
    // enrollment. Mint the AAL2 cookie now so middleware does not bounce
    // them straight back to /verify-2fa on their next navigation.
    const host = request.headers.get('host') || undefined;
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const protocol = forwardedProto ? `${forwardedProto}:` : undefined;

    const res = NextResponse.json({
      success: true,
      backupCodes, // Return plain backup codes to user (only time they'll see them)
    });
    await setTwoFactorCookie(res, user.id, host, protocol);
    return res;
  } catch (error) {
    logger.error('2FA verification error', { error });
    return NextResponse.json(
      { error: 'Failed to verify 2FA' },
      { status: 500 }
    );
  }
}
