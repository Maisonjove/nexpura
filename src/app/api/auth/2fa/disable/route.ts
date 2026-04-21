import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { clearTwoFactorCookie } from '@/lib/auth/two-factor-cookie';

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

    // PR-05: clear the 2FA proof cookie — no longer meaningful once the
    // factor is disabled, and guarantees that if 2FA is re-enabled later
    // the user must re-prove possession before the middleware trusts them.
    const host = request.headers.get('host') || undefined;
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const protocol = forwardedProto ? `${forwardedProto}:` : undefined;
    const res = NextResponse.json({ success: true });
    clearTwoFactorCookie(res, host, protocol);
    return res;
  } catch (error) {
    logger.error('2FA disable error', { error });
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
