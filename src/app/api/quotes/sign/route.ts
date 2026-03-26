import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import logger from '@/lib/logger';
import { quoteSignSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit quote signing per user
    const { success: rateLimitOk } = await checkRateLimit(`quote-sign:${user.id}`);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const parseResult = quoteSignSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { quoteId, signatureData } = parseResult.data;

    const admin = createAdminClient();

    // Get user's tenant
    const { data: userData } = await admin
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    // Verify quote belongs to tenant
    const { data: quote } = await admin
      .from('quotes')
      .select('id, status, customer_id')
      .eq('id', quoteId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status === 'accepted' || quote.status === 'converted') {
      return NextResponse.json(
        { error: 'Quote has already been accepted' },
        { status: 400 }
      );
    }

    // Update quote with signature
    const { error } = await admin
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
        signature_data: signatureData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (error) {
      logger.error('Error updating quote', { error, quoteId });
      return NextResponse.json({ error: 'Failed to accept quote' }, { status: 500 });
    }

    // Log the event
    try {
      await admin.from('quote_events').insert({
        quote_id: quoteId,
        event_type: 'signed',
        description: 'Quote accepted with digital signature',
        created_by: user.id,
      });
    } catch (e) {
      // Event logging is non-critical
      logger.warn('Could not log quote event', { error: e, quoteId });
    }

    return NextResponse.json({
      success: true,
      message: 'Quote accepted successfully',
    });
  } catch (error) {
    logger.error('Quote sign error', { error });
    return NextResponse.json(
      { error: 'Failed to sign quote' },
      { status: 500 }
    );
  }
}
