import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const admin = createAdminClient();
    
    // Get user's phone number
    const { data: profile } = await admin
      .from('users')
      .select('sms_2fa_enabled, sms_2fa_phone')
      .eq('id', userId)
      .single();

    if (!profile?.sms_2fa_enabled || !profile?.sms_2fa_phone) {
      return NextResponse.json({ error: 'SMS 2FA not enabled' }, { status: 400 });
    }

    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the code
    await admin
      .from('users')
      .update({
        sms_2fa_code: code,
        sms_2fa_code_expires_at: expiresAt.toISOString(),
      })
      .eq('id', userId);

    // Send SMS via Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      // Fallback: log the code for development
      logger.info('SMS 2FA Login - dev mode verification code', { phone: profile.sms_2fa_phone, code });
      return NextResponse.json({ 
        success: true, 
        message: 'Verification code sent (dev mode)',
        phoneMasked: profile.sms_2fa_phone.slice(0, 4) + '****' + profile.sms_2fa_phone.slice(-2),
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
        To: profile.sms_2fa_phone,
        Body: `Your Nexpura login code is: ${code}. It expires in 10 minutes.`,
      }),
    });

    if (!smsResponse.ok) {
      const twilioError = await smsResponse.json();
      logger.error('SMS 2FA Login - Twilio error', { error: twilioError });
      return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      phoneMasked: profile.sms_2fa_phone.slice(0, 4) + '****' + profile.sms_2fa_phone.slice(-2),
    });
  } catch (error) {
    logger.error('SMS 2FA login send error', { error });
    return NextResponse.json(
      { error: 'Failed to send login code' },
      { status: 500 }
    );
  }
}
