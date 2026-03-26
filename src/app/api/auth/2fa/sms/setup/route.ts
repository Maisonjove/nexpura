import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\s/g, '').replace(/^0/, '+61');

    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
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

    // Send SMS via Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      // Fallback: log the code for development
      logger.info('SMS 2FA - dev mode verification code', { phone: normalizedPhone, code });
      return NextResponse.json({ 
        success: true, 
        message: 'Verification code sent (dev mode - check logs)',
        phone: normalizedPhone,
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');

    const smsResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: twilioFromNumber,
        To: normalizedPhone,
        Body: `Your Nexpura verification code is: ${code}. It expires in 10 minutes.`,
      }),
    });

    if (!smsResponse.ok) {
      const twilioError = await smsResponse.json();
      logger.error('SMS 2FA - Twilio error', { error: twilioError });
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
}
