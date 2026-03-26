import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTOTPSecret, generateTOTPQRCode } from '@/lib/totp';
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

    // Get user email
    const { data: profile } = await supabase
      .from('users')
      .select('email, totp_enabled')
      .eq('id', user.id)
      .single();

    if (profile?.totp_enabled) {
      return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 });
    }

    const email = profile?.email || user.email || '';
    
    // Generate new secret
    const secret = generateTOTPSecret();
    
    // Generate QR code
    const qrCode = await generateTOTPQRCode(secret, email, 'Nexpura');

    // Store the pending secret temporarily (we'll save it permanently after verification)
    // For now, we return it to the client and verify in the next step
    // In production, you might want to store this server-side with a short TTL

    return NextResponse.json({ 
      secret,
      qrCode,
    });
  } catch (error) {
    logger.error('2FA setup error', { error });
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}
