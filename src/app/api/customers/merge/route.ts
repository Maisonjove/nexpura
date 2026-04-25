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

    // Get user's tenant + role
    const { data: userData } = await admin
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    // Merging customers is destructive and rewrites FK pointers across
    // sales / repairs / invoices etc. — owner/admin/manager only.
    const role = (userData as { role?: string }).role ?? 'staff';
    if (!['owner', 'admin', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    // Update all related records to point to primary customer.
    // Pre-fix list missed wishlists, loyalty_transactions, customer_notes,
    // customer_communications, customer_store_credit_history. The
    // secondary's wishlist + loyalty rows kept FK-pointing at the
    // tombstone after merge → disappeared from primary's detail page.
    // 'communications' was a typo (real table is customer_communications).
    const tablesToUpdate = [
      'sales',
      'repairs',
      'bespoke_jobs',
      'invoices',
      'quotes',
      'enquiries',
      'appointments',
      'wishlists',
      'loyalty_transactions',
      'customer_notes',
      'customer_communications',
      'customer_store_credit_history',
    ];

    for (const table of tablesToUpdate) {
      try {
        await admin
          .from(table)
          .update({ customer_id: primaryId })
          // Scope every FK rewrite to this tenant as defence-in-depth.
          // UUID collisions across tenants are astronomically unlikely
          // but a misrouted merge would be silently cross-tenant without
          // this guard.
          .eq('tenant_id', tenantId)
          .in('customer_id', secondaryIds);
      } catch (e) {
        // Table might not exist or not have customer_id - skip
        logger.debug(`Skipping table ${table} during customer merge`, { error: e });
      }
    }

    // Soft delete secondary customers (mark as merged). Scope by
    // tenant_id for the same defence-in-depth reason as the FK rewrites.
    await admin
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
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
