import { createAdminClient } from './supabase/admin';

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
    await admin.from('staff_activity_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      action_type: actionType,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      entity_label: entityLabel ?? null,
      metadata: metadata ?? null,
    });
  } catch {
    // Activity logging is non-critical, never throw
  }
}
