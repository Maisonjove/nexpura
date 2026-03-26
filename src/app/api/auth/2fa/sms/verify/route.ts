import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateBackupCodes, hashBackupCode } from '@/lib/totp';
import logger from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    const admin = createAdminClient();
    
    // Get the pending verification
    const { data: profile } = await admin
      .from('users')
      .select('sms_2fa_phone_pending, sms_2fa_code, sms_2fa_code_expires_at')
      .eq('id', user.id)
      .single();

    if (!profile?.sms_2fa_code || !profile?.sms_2fa_phone_pending) {
      return NextResponse.json({ error: 'No pending SMS verification' }, { status: 400 });
    }

    // Check if code is expired
    if (new Date(profile.sms_2fa_code_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Verification code expired' }, { status: 400 });
    }

    // Verify the code
    if (profile.sms_2fa_code !== code) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(8);
    const hashedBackupCodes = await Promise.all(backupCodes.map(hashBackupCode));

    // Enable SMS 2FA
    await admin
      .from('users')
      .update({
        sms_2fa_enabled: true,
        sms_2fa_phone: profile.sms_2fa_phone_pending,
        sms_2fa_phone_pending: null,
        sms_2fa_code: null,
        sms_2fa_code_expires_at: null,
        totp_enabled: false, // Disable TOTP if switching to SMS
        totp_secret: null,
        totp_backup_codes: hashedBackupCodes,
      })
      .eq('id', user.id);

    return NextResponse.json({ 
      success: true,
      backupCodes,
    });
  } catch (error) {
    logger.error('SMS 2FA verify error', { error });
    return NextResponse.json(
      { error: 'Failed to verify SMS code' },
      { status: 500 }
    );
  }
}
