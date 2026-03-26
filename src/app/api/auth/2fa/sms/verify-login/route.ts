import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyBackupCode } from '@/lib/totp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, code, isBackupCode } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: 'User ID and code required' }, { status: 400 });
    }

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
    console.error('SMS 2FA verify login error:', error);
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}
