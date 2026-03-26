import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTOTPToken, generateBackupCodes, hashBackupCode } from '@/lib/totp';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, secret } = await request.json();

    if (!code || !secret) {
      return NextResponse.json({ error: 'Missing code or secret' }, { status: 400 });
    }

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
      console.error('Failed to enable 2FA:', updateError);
      return NextResponse.json({ error: 'Failed to enable 2FA' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      backupCodes, // Return plain backup codes to user (only time they'll see them)
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify 2FA' },
      { status: 500 }
    );
  }
}
