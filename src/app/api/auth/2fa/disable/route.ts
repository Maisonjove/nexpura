import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Disable 2FA using admin client to bypass RLS
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('users')
      .update({
        totp_secret: null,
        totp_enabled: false,
        totp_backup_codes: null,
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to disable 2FA', { error: updateError });
      return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('2FA disable error', { error });
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
