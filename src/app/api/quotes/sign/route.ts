import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quoteId, signatureData } = body;

    if (!quoteId || !signatureData) {
      return NextResponse.json(
        { error: 'Quote ID and signature data are required' },
        { status: 400 }
      );
    }

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
      console.error('Error updating quote:', error);
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
      console.log('Could not log quote event:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Quote accepted successfully',
    });
  } catch (error) {
    console.error('Quote sign error:', error);
    return NextResponse.json(
      { error: 'Failed to sign quote' },
      { status: 500 }
    );
  }
}
