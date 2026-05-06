'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import logger from '@/lib/logger';

export type AuditAction =
  | 'inventory_create'
  | 'inventory_update'
  | 'inventory_delete'
  | 'inventory_stock_adjust'
  | 'inventory_receive'
  | 'customer_create'
  | 'customer_update'
  | 'customer_delete'
  | 'invoice_create'
  | 'invoice_update'
  | 'invoice_status_change'
  | 'invoice_delete'
  | 'repair_create'
  | 'repair_update'
  | 'repair_stage_change'
  | 'bespoke_create'
  | 'bespoke_update'
  | 'bespoke_stage_change'
  | 'settings_update'
  | 'team_member_create'
  | 'team_member_update'
  | 'team_member_delete'
  | 'team_member_invite'
  | 'team_member_locations_update'
  | 'team_member_notifications_update'
  | 'location_create'
  | 'location_update'
  | 'location_delete'
  | 'quote_create'
  | 'quote_update'
  | 'quote_delete'
  | 'quote_convert'
  | 'sale_create'
  | 'sale_void'
  | 'payment_create'
  | 'layby_payment'
  | 'layby_cancel'
  | 'task_create'
  | 'task_update'
  | 'task_delete'
  | 'supplier_create'
  | 'supplier_update'
  | 'supplier_delete'
  | 'expense_create'
  | 'expense_update'
  | 'expense_delete'
  | 'voucher_create'
  | 'voucher_void'
  | 'refund_create'
  | 'stocktake_create'
  | 'stocktake_update'
  | 'stocktake_complete'
  | 'appraisal_create'
  | 'appraisal_update'
  | 'appraisal_issue'
  | 'passport_create'
  | 'passport_update'
  | 'passport_transfer'
  | 'memo_create'
  | 'memo_update'
  | 'memo_status_change'
  | 'enquiry_status_change'
  | 'eod_submit'
  | 'campaign_create'
  | 'campaign_update'
  | 'campaign_send'
  | 'campaign_delete'
  | 'login'
  | 'logout'
  | 'stripe_connect_disconnect'
  | 'stripe_connect_deauthorize_failed'
  // A1 Day 2 (2026-05-06): manager PIN events for refund overrides.
  | 'manager_pin_set'
  | 'manager_pin_reset'
  // A1 Day 1 (2026-05-06): data repairs (May Nexpura outlier
  // rollback, future synthetic backfills with provenance metadata).
  | 'data_repair';

export type EntityType =
  | 'inventory'
  | 'customer'
  | 'invoice'
  | 'repair'
  | 'bespoke_job'
  | 'settings'
  | 'team_member'
  | 'location'
  | 'user'
  | 'quote'
  | 'sale'
  | 'payment'
  | 'layby'
  | 'task'
  | 'supplier'
  | 'expense'
  | 'voucher'
  | 'refund'
  | 'stocktake'
  | 'appraisal'
  | 'passport'
  | 'memo'
  | 'enquiry'
  | 'eod_reconciliation'
  | 'campaign'
  | 'tenant';

interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to the audit_logs table.
 * Call this from server actions after important changes.
 */
export async function logAuditEvent({
  tenantId,
  userId,
  action,
  entityType,
  entityId,
  oldData,
  newData,
  metadata,
}: AuditLogEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    
    // Get IP and user agent from headers
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || headersList.get('x-real-ip') 
      || null;
    const userAgent = headersList.get('user-agent') || null;

    // Side-effect log+continue: audit_logs is observability — a failed
    // insert means we lose one row from the audit trail but the actual
    // business write that triggered this call already succeeded. The
    // function signature is `Promise<void>` and the catch below also
    // log+swallows; this matches the design intent.
    const { error: insertErr } = await admin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: userId || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      old_data: oldData || null,
      new_data: newData || null,
      ip_address: ip,
      user_agent: userAgent,
      metadata: metadata || {},
    });
    if (insertErr) {
      logger.error('[audit] audit_logs insert failed (non-fatal — audit trail gap)', {
        action, entityType, entityId, tenantId, err: insertErr,
      });
    }
  } catch (error) {
    // Log but don't throw - audit logging should not break the main flow
    logger.error('Failed to log audit event', { error, action, entityType, entityId });
  }
}

// Note: createAuditDiff moved to audit-utils.ts (non-server file)
// since 'use server' requires all exports to be async
