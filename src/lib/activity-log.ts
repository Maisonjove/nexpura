import { createAdminClient } from './supabase/admin';
import logger from './logger';

export async function logActivity(
  tenantId: string,
  userId: string | null,
  actionType: string,
  entityType?: string | null,
  entityId?: string | null,
  entityLabel?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  try {
    const admin = createAdminClient();
    // Side-effect log+continue: staff_activity_logs is the observability
    // layer for who-did-what; a failed insert means the audit trail
    // misses one row but the underlying business action (whatever called
    // logActivity) already succeeded. Caller signature is `Promise<void>`
    // by design — never throw, never propagate.
    const { error } = await admin.from('staff_activity_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      action_type: actionType,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      entity_label: entityLabel ?? null,
      metadata: metadata ?? null,
    });
    if (error) {
      logger.error('[activity-log] insert failed (non-fatal — audit trail gap)', {
        tenantId, userId, actionType, entityType, entityId, err: error,
      });
    }
  } catch {
    // Activity logging is non-critical, never throw
  }
}
