import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyBackupCode } from '@/lib/totp';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { sms2FAVerifyLoginSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  // Strict rate limiting for auth endpoints
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success: rlSuccess } = await checkRateLimit(ip, 'auth');
  if (!rlSuccess) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parseResult = sms2FAVerifyLoginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { userId, code, isBackupCode } = parseResult.data;

    const admin = createAdminClient();
    
    // Get user's verification data
    const { data: profile } = await admin
      .from('users')
      .select('sms_2fa_code, sms_2fa_code_expires_at, totp_backup_codes')
      .eq('id', userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }

    // Check if using backup code
    if (isBackupCode) {
      const backupCodes = profile.totp_backup_codes || [];
      const { valid, usedIndex } = await verifyBackupCode(code, backupCodes);
      
      if (!valid) {
        return NextResponse.json({ error: 'Invalid backup code' }, { status: 400 });
      }

      // Mark backup code as used
      const updatedBackupCodes = [...backupCodes];
      updatedBackupCodes[usedIndex] = null;
      
      await admin
        .from('users')
        .update({ totp_backup_codes: updatedBackupCodes })
        .eq('id', userId);

      return NextResponse.json({ success: true });
    }

    // Verify SMS code
    if (!profile.sms_2fa_code) {
      return NextResponse.json({ error: 'No verification code pending' }, { status: 400 });
    }

    // Check if code is expired
    if (new Date(profile.sms_2fa_code_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Verification code expired' }, { status: 400 });
    }

    // Verify the code
    if (profile.sms_2fa_code !== code) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Clear the used code
    await admin
      .from('users')
      .update({
        sms_2fa_code: null,
        sms_2fa_code_expires_at: null,
      })
      .eq('id', userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('SMS 2FA verify login error', { error });
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}
