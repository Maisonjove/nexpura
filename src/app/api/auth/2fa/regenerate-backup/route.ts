import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateBackupCodes, hashBackupCode } from '@/lib/totp';
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

    // Check if 2FA is enabled
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('totp_enabled')
      .eq('id', user.id)
      .single();

    if (!profile?.totp_enabled) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
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
}
