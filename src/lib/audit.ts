'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';

export type AuditAction =
  | 'inventory_create'
  | 'inventory_update'
  | 'inventory_delete'
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
  | 'location_create'
  | 'location_update'
  | 'login'
  | 'logout';

export type EntityType =
  | 'inventory'
  | 'customer'
  | 'invoice'
  | 'repair'
  | 'bespoke_job'
  | 'settings'
  | 'team_member'
  | 'location'
  | 'user';

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
    console.error('[Audit] Failed to log event:', error);
  }
}

/**
 * Helper to create a diff between old and new data.
 * Useful for showing what changed in the activity log.
 */
export function createAuditDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): { changed: Record<string, { old: unknown; new: unknown }> } {
  const changed: Record<string, { old: unknown; new: unknown }> = {};
  
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    
    // Skip if both undefined or null
    if (oldVal === undefined && newVal === undefined) continue;
    if (oldVal === null && newVal === null) continue;
    
    // Check if values differ
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed[key] = { old: oldVal, new: newVal };
    }
  }
  
  return { changed };
}
