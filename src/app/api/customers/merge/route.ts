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

    // Joey 2026-05-03 P2-E audit: defend against merge-into-self.
    // The Zod schema doesn't enforce primaryId ∉ secondaryIds; a
    // self-merge would soft-delete the primary at the bottom of this
    // handler. Reject explicitly.
    if (secondaryIds.includes(primaryId)) {
      return NextResponse.json({ error: "Cannot merge a customer into itself" }, { status: 400 });
    }

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

    // Joey 2026-05-03 P2-E audit: pre-fix this list had 12 entries
    // including 2 dead ones (`enquiries` — real name shop_enquiries,
    // and shop_enquiries doesn't have customer_id; `customer_notes` —
    // table doesn't exist), and was missing 7 tables that DO have
    // customer_id and would orphan rows after merge.
    //
    // Schema-driven discovery (information_schema query at audit
    // time): 17 tables have a customer_id column. Filtered list below
    // matches the 17 minus the dead names, plus the 7 previously
    // missed. Every entry is verified-existent at audit time.
    //
    // Without these fixes, post-merge the surviving customer's detail
    // tabs would be missing: appraisals, communications (general),
    // email_sends, memo_items, refunds, sms_sends, whatsapp_sends.
    const tablesToUpdate = [
      'appointments',
      'appraisals',                     // P2-E added: orphaned valuations
      'bespoke_jobs',
      'communications',                 // P2-E added: general comms history
      'customer_communications',
      'customer_store_credit_history',
      'email_sends',                    // P2-E added: orphaned email log
      'invoices',
      'loyalty_transactions',
      'memo_items',                     // P2-E added: orphaned memo history
      'quotes',
      'refunds',                        // P2-E added: orphaned refund history
      'repairs',
      'sales',
      'sms_sends',                      // P2-E added: orphaned SMS history
      'whatsapp_sends',                 // P2-E added: orphaned WhatsApp history
      'wishlists',
    ];

    const fkRewriteFailures: Array<{ table: string; error: string }> = [];
    for (const table of tablesToUpdate) {
      const { error } = await admin
        .from(table)
        .update({ customer_id: primaryId })
        // Scope every FK rewrite to this tenant as defence-in-depth.
        // UUID collisions across tenants are astronomically unlikely
        // but a misrouted merge would be silently cross-tenant without
        // this guard.
        .eq('tenant_id', tenantId)
        .in('customer_id', secondaryIds);
      if (error) {
        // Joey 2026-05-03 P2-E audit: surface failures rather than
        // swallow. A single failed FK rewrite leaves the customer's
        // detail page silently inconsistent; loud failure means the
        // operator can re-run or fix manually.
        logger.error(`[customers/merge] FK rewrite failed on ${table}`, { tenantId, primaryId, error });
        fkRewriteFailures.push({ table, error: error.message });
      }
    }
    if (fkRewriteFailures.length > 0) {
      // Don't abort — the customer record + tag/note merge already
      // succeeded. But return the per-table failure list so the
      // operator can decide whether to manually fix or revert.
      logger.error(`[customers/merge] Partial merge: ${fkRewriteFailures.length} table(s) failed`, { tenantId, primaryId, fkRewriteFailures });
    }

    // Soft delete secondary customers (mark as merged). Scope by
    // tenant_id for the same defence-in-depth reason as the FK rewrites.
    const { error: softDelErr } = await admin
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .in('id', secondaryIds);
    if (softDelErr) {
      logger.error('[customers/merge] secondary soft-delete failed', { tenantId, secondaryIds, error: softDelErr });
      return NextResponse.json(
        { error: 'Merge partially completed but secondary delete failed', primaryId, secondaryIds, details: softDelErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      primaryId,
      mergedCount: secondaryIds.length,
      ...(fkRewriteFailures.length > 0 ? { fkRewriteFailures } : {}),
    });
  } catch (error) {
    logger.error('Customer merge error', { error });
    return NextResponse.json(
      { error: 'Failed to merge customers' },
      { status: 500 }
    );
  }
}
