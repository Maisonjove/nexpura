import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTOTPToken, verifyBackupCode } from '@/lib/totp';
import logger from '@/lib/logger';

/**
 * Validate a 2FA code during login
 * This is called after successful password authentication
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, code } = await request.json();

    if (!userId || !code) {
      return NextResponse.json({ error: 'Missing userId or code' }, { status: 400 });
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
    
    // Check if it's a 6-digit TOTP code
    if (/^\d{6}$/.test(normalizedCode)) {
      const isValid = verifyTOTPToken(normalizedCode, profile.totp_secret);
      
      if (isValid) {
        return NextResponse.json({ valid: true, method: 'totp' });
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

        return NextResponse.json({ valid: true, method: 'backup_code' });
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
