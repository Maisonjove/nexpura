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
  | 'stripe_connect_deauthorize_failed';

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

    await admin.from('audit_logs').insert({
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
  } catch (error) {
    // Log but don't throw - audit logging should not break the main flow
    logger.error('Failed to log audit event', { error, action, entityType, entityId });
  }
}

// Note: createAuditDiff moved to audit-utils.ts (non-server file)
// since 'use server' requires all exports to be async
