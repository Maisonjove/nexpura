import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit";
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

/**
 * /api/migration/rollback — rollback a completed migration import.
 *
 * Pre-fix the migration system had no in-app rollback for a 'complete'
 * session. If a tenant ran a bad import they had to drop into a SQL
 * shell to remove the inserted rows. Now: this endpoint deletes every
 * destination row that was written by the session (looked up via
 * migration_job_records.destination_record_id + destination_table),
 * marks the session 'rolled_back', logs an audit event, and returns
 * counts per entity.
 *
 * Owner / manager only — same gate as the original execute path.
 */

interface RollbackBody {
  sessionId: string;
  confirm: true;
}

export const POST = withSentryFlush(async (req: NextRequest) => {
  let body: RollbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.sessionId || body.confirm !== true) {
    return NextResponse.json({ error: "sessionId and confirm=true required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id;
  const role = (userData as { role?: string })?.role ?? "staff";
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  if (!["owner", "admin", "manager"].includes(role)) {
    return NextResponse.json({ error: "Only owner or manager can roll back imports." }, { status: 403 });
  }

  const { data: session } = await admin
    .from("migration_sessions")
    .select("id, status")
    .eq("id", body.sessionId)
    .eq("tenant_id", tenantId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (session.status !== "complete" && session.status !== "complete_with_errors" && session.status !== "failed") {
    return NextResponse.json(
      { error: `Cannot rollback a session in status '${session.status}' — only completed sessions can be rolled back.` },
      { status: 400 },
    );
  }

  // Group records by destination_table so we can do one bulk delete per
  // table instead of N round-trips. Skip records with no destination_record_id
  // (those are skips, errors, or already-rolled-back rows).
  const { data: records } = await admin
    .from("migration_job_records")
    .select("id, destination_table, destination_record_id")
    .eq("session_id", body.sessionId)
    .eq("tenant_id", tenantId)
    .not("destination_record_id", "is", null);

  if (!records || records.length === 0) {
    return NextResponse.json({ error: "No imported records found to rollback." }, { status: 400 });
  }

  const byTable: Record<string, string[]> = {};
  for (const r of records) {
    const table = (r.destination_table as string | null) ?? null;
    const recId = (r.destination_record_id as string | null) ?? null;
    if (!table || !recId) continue;
    if (!byTable[table]) byTable[table] = [];
    byTable[table].push(recId);
  }

  const deletedByTable: Record<string, number> = {};
  for (const [table, ids] of Object.entries(byTable)) {
    try {
      // Soft-delete where the table supports it; otherwise hard delete.
      const tablesWithSoftDelete = new Set(["customers", "inventory", "repairs", "bespoke_jobs", "invoices", "suppliers"]);
      if (tablesWithSoftDelete.has(table)) {
        const { error, data: updated } = await admin
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .in("id", ids)
          .eq("tenant_id", tenantId)
          .select("id");
        if (error) {
          logger.error(`[migration rollback] soft-delete failed on ${table}`, { error });
          continue;
        }
        deletedByTable[table] = updated?.length ?? 0;
      } else {
        const { error, data: deleted } = await admin
          .from(table)
          .delete()
          .in("id", ids)
          .eq("tenant_id", tenantId)
          .select("id");
        if (error) {
          logger.error(`[migration rollback] hard-delete failed on ${table}`, { error });
          continue;
        }
        deletedByTable[table] = deleted?.length ?? 0;
      }
    } catch (err) {
      logger.error(`[migration rollback] exception on ${table}`, { err });
    }
  }

  await admin.from("migration_sessions")
    .update({ status: "rolled_back", updated_at: new Date().toISOString() })
    .eq("id", body.sessionId);

  await admin.from("migration_logs").insert({
    tenant_id: tenantId,
    session_id: body.sessionId,
    action: "session_rolled_back",
    actor_id: user.id,
    details: {
      deleted_by_table: deletedByTable,
      total_deleted: Object.values(deletedByTable).reduce((s, n) => s + n, 0),
    },
  });

  await logAuditEvent({
    tenantId,
    userId: user.id,
    action: "settings_update",
    entityType: "settings",
    entityId: body.sessionId,
    newData: { kind: "migration_rollback", deletedByTable },
  });

  return NextResponse.json({
    ok: true,
    sessionId: body.sessionId,
    deletedByTable,
    totalDeleted: Object.values(deletedByTable).reduce((s, n) => s + n, 0),
  });
});
