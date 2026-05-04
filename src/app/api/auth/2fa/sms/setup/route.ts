import { withSentryFlush } from "@/lib/sentry-flush";
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { sms2FASetupSchema } from '@/lib/schemas';
import { sendTwilioSms } from '@/lib/twilio-sms';

export const POST = withSentryFlush(async (request: NextRequest) => {
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

    const body = await request.json();
    const parseResult = sms2FASetupSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { phone } = parseResult.data;

    // Normalize phone number
    const normalizedPhone = phone.replace(/\s/g, '').replace(/^0/, '+61');

    // Use crypto.randomInt instead of Math.random — V8 PRNG state is
    // recoverable from a few outputs, making future codes predictable.
    const { randomInt } = await import("node:crypto");
    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the pending verification
    const admin = createAdminClient();
    await admin
      .from('users')
      .update({
        sms_2fa_phone_pending: normalizedPhone,
        sms_2fa_code: code,
        sms_2fa_code_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id);

    // Send SMS via the sandbox-aware Twilio helper. In preview/dev/SANDBOX_MODE
    // this returns fake success without hitting Twilio.
    const smsResult = await sendTwilioSms(
      normalizedPhone,
      `Your Nexpura verification code is: ${code}. It expires in 10 minutes.`,
    );

    if (!smsResult.success) {
      logger.error('SMS 2FA - Twilio error', { error: smsResult.error });
      return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent',
      phone: normalizedPhone,
    });
  } catch (error) {
    logger.error('SMS 2FA setup error', { error });
    return NextResponse.json(
      { error: 'Failed to setup SMS 2FA' },
      { status: 500 }
    );
  }
});
