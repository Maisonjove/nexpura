import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    
    // Disable SMS 2FA
    await admin
      .from('users')
      .update({
        sms_2fa_enabled: false,
        sms_2fa_phone: null,
        sms_2fa_phone_pending: null,
        sms_2fa_code: null,
        sms_2fa_code_expires_at: null,
        totp_backup_codes: null,
      })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SMS 2FA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable SMS 2FA' },
      { status: 500 }
    );
  }
}
