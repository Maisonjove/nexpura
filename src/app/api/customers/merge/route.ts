import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';
import { customerMergeSchema } from '@/lib/schemas';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await checkRateLimit(ip, 'heavy');
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
    const parseResult = customerMergeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { primaryId, secondaryIds } = parseResult.data;

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

    const tenantId = userData.tenant_id;

    // Verify all customers belong to this tenant
    const { data: customers } = await admin
      .from('customers')
      .select('id, tags, is_vip, notes')
      .eq('tenant_id', tenantId)
      .in('id', [primaryId, ...secondaryIds]);

    if (!customers || customers.length !== secondaryIds.length + 1) {
      return NextResponse.json(
        { error: 'One or more customers not found' },
        { status: 404 }
      );
    }

    const primaryCustomer = customers.find(c => c.id === primaryId);
    const secondaryCustomersList = customers.filter(c => c.id !== primaryId);

    // Merge tags from secondary customers
    const allTags = new Set<string>(primaryCustomer?.tags || []);
    const allNotes: string[] = [];
    let isVip = primaryCustomer?.is_vip || false;

    for (const sec of secondaryCustomersList) {
      if (sec.tags) {
        sec.tags.forEach((t: string) => allTags.add(t));
      }
      if (sec.is_vip) {
        isVip = true;
      }
      if (sec.notes) {
        allNotes.push(`[Merged from customer ${sec.id}]: ${sec.notes}`);
      }
    }

    // Update primary customer with merged tags
    const mergedNotes = [
      primaryCustomer?.notes || '',
      ...allNotes,
      `\n[Merged ${secondaryIds.length} customer record(s) on ${new Date().toISOString()}]`
    ].filter(Boolean).join('\n');

    await admin
      .from('customers')
      .update({
        tags: Array.from(allTags),
        is_vip: isVip,
        notes: mergedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', primaryId);

    // Update all related records to point to primary customer
    const tablesToUpdate = [
      'sales',
      'repairs',
      'bespoke_jobs',
      'invoices',
      'quotes',
      'enquiries',
      'appointments',
      'communications',
    ];

    for (const table of tablesToUpdate) {
      try {
        await admin
          .from(table)
          .update({ customer_id: primaryId })
          .in('customer_id', secondaryIds);
      } catch (e) {
        // Table might not exist or not have customer_id - skip
        logger.debug(`Skipping table ${table} during customer merge`, { error: e });
      }
    }

    // Soft delete secondary customers (mark as merged)
    await admin
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .in('id', secondaryIds);

    return NextResponse.json({
      success: true,
      primaryId,
      mergedCount: secondaryIds.length,
    });
  } catch (error) {
    logger.error('Customer merge error', { error });
    return NextResponse.json(
      { error: 'Failed to merge customers' },
      { status: 500 }
    );
  }
}
