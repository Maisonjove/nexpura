/**
 * /api/cron/process-tenant-deletions
 *
 * P2-E priority-zero (Joey 2026-05-03). The /api/data-delete endpoint
 * accepts a GDPR deletion request, sets tenants.deletion_requested_at
 * + deletion_scheduled_for (T+30 days), and returns "data deletion
 * scheduled" to the customer. Pre-fix there was NO cron that actually
 * executed the deletion at T+30 — the GDPR feature was decorative.
 *
 * This cron runs daily at 04:00 UTC. For each tenant where
 * deletion_scheduled_for has passed and the tenant isn't already
 * hard-deleted, it:
 *
 *   1. Captures pre-delete row counts on a few representative tables
 *      (sanity check that cascades did their job).
 *   2. Inserts a row into deleted_tenants_audit (permanent retention,
 *      no FK to tenants — survives the upcoming DELETE).
 *   3. DELETEs the two NO-ACTION-FK tables (bespoke_milestones,
 *      pilot_issues) explicitly. The other 87 child tables CASCADE
 *      from the tenants delete.
 *   4. Purges Storage buckets keyed by tenant_id prefix (NOT
 *      cascaded by SQL — Storage objects live outside Postgres).
 *   5. DELETEs the tenants row, which cascades to 87 child tables.
 *   6. Updates the audit row with files_purged_count.
 *
 * Auth: bearer match against CRON_SECRET (same convention as the
 * other vercel-managed crons).
 *
 * Failure mode: per-tenant try/catch. A failing storage purge or a
 * stuck FK on one tenant doesn't block other tenants in the same
 * cron run. The audit row records files_purge_errors for forensics.
 *
 * Idempotency: once a tenant is DELETE'd, it disappears from the
 * scheduled-for-deletion query — re-runs naturally skip it.
 *
 * NEXPURA_DOGFOOD_TENANT_ID is excluded as a hard safety: even if
 * Joey accidentally requests deletion of his own dogfood tenant,
 * this cron refuses. The free_forever_dogfood_only CHECK constraint
 * enforces is_free_forever=true on that one row, but accidental
 * deletion via the GDPR flow would still wipe it. Belt-and-suspenders.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import { NEXPURA_DOGFOOD_TENANT_ID } from "@/lib/dogfood-tenant";
import logger from "@/lib/logger";

export const maxDuration = 300;

// Buckets that may contain tenant-owned files. Each bucket stores files
// under a prefix that includes the tenant id. The shape is consistent
// across the codebase: paths like `<tenant_id>/<arbitrary>` or
// `<tenant_id>/<subfolder>/<file>`. Listing by prefix gives us
// everything to delete for one tenant.
const TENANT_OWNED_BUCKETS = [
  "inventory-photos",
  "job-photos",
  "logos",
  "migration-files",
  "order-attachments",
  "passport-photos",
  "repair-photos",
];

interface DeletionTenant {
  id: string;
  name: string | null;
  business_name: string | null;
  deletion_requested_at: string;
  deletion_scheduled_for: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  // Find tenants whose grace period has expired and that haven't
  // already been hard-deleted by some other path. Limit to a small
  // batch per run to keep the cron under maxDuration even if one
  // tenant's storage purge is slow.
  const { data: due, error: dueErr } = await admin
    .from("tenants")
    .select(
      "id, name, business_name, deletion_requested_at, deletion_scheduled_for",
    )
    .not("deletion_scheduled_for", "is", null)
    .lt("deletion_scheduled_for", startedAt)
    .is("deleted_at", null)
    .neq("id", NEXPURA_DOGFOOD_TENANT_ID)
    .limit(10);

  if (dueErr) {
    logger.error("[cron/process-tenant-deletions] due-tenants query failed", { err: dueErr });
    return NextResponse.json({ ok: false, error: "due_query_failed" }, { status: 500 });
  }

  const dueList = (due ?? []) as DeletionTenant[];

  if (dueList.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, started_at: startedAt });
  }

  const results: Array<{ tenant_id: string; status: string; details?: unknown }> = [];

  for (const t of dueList) {
    try {
      const result = await deleteOneTenant(admin, t);
      results.push({ tenant_id: t.id, status: "deleted", details: result });
    } catch (err) {
      logger.error("[cron/process-tenant-deletions] per-tenant failure", {
        tenant_id: t.id,
        err: err instanceof Error ? err.message : String(err),
      });
      results.push({
        tenant_id: t.id,
        status: "failed",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: dueList.length,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    results,
  });
}

async function deleteOneTenant(
  admin: ReturnType<typeof createAdminClient>,
  t: DeletionTenant,
): Promise<{ files_purged: number; files_purge_errors: string | null }> {
  // 1. Find owner email for the audit record (best-effort).
  const { data: owner } = await admin
    .from("users")
    .select("email")
    .eq("tenant_id", t.id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  // 2. Capture pre-delete sanity counts on representative tables. If
  //    something goes wrong with the cascade, this lets us reconstruct
  //    what we lost.
  const sampleTables = [
    "customers", "sales", "invoices", "repairs", "bespoke_jobs",
    "communications", "inventory", "audit_logs", "users", "settings",
  ];
  const preCounts: Record<string, number> = {};
  for (const tbl of sampleTables) {
    const { count } = await admin
      .from(tbl)
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", t.id);
    preCounts[tbl] = count ?? 0;
  }

  // 3. Insert the audit row BEFORE we destroy anything. If something
  //    fails downstream the audit row stays as evidence that we tried.
  const { error: auditErr } = await admin.from("deleted_tenants_audit").insert({
    original_tenant_id: t.id,
    tenant_name: t.business_name || t.name,
    owner_email: owner?.email ?? null,
    deletion_requested_at: t.deletion_requested_at,
    deletion_scheduled_for: t.deletion_scheduled_for,
    files_purged_count: 0,
    pre_delete_row_counts: preCounts,
  });
  if (auditErr) {
    throw new Error(`audit insert failed: ${auditErr.message}`);
  }

  // 4. DELETE the two NO-ACTION-FK child tables explicitly.
  //    bespoke_milestones + pilot_issues — without this the tenants
  //    DELETE would error with FK violation.
  for (const tbl of ["bespoke_milestones", "pilot_issues"]) {
    const { error } = await admin.from(tbl).delete().eq("tenant_id", t.id);
    if (error) {
      throw new Error(`pre-delete ${tbl} failed: ${error.message}`);
    }
  }

  // 5. Storage purge — list and delete all tenant-prefixed files
  //    across the buckets that may hold tenant data.
  let filesPurged = 0;
  const purgeErrors: string[] = [];
  for (const bucket of TENANT_OWNED_BUCKETS) {
    try {
      const purged = await purgeBucketForTenant(admin, bucket, t.id);
      filesPurged += purged;
    } catch (err) {
      purgeErrors.push(`${bucket}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 6. Hard-delete the tenants row. This cascades to 87 child tables.
  const { error: delErr } = await admin
    .from("tenants")
    .delete()
    .eq("id", t.id);
  if (delErr) {
    throw new Error(`tenants delete failed: ${delErr.message}`);
  }

  // 7. Update the audit record with the storage tally. (The tenants
  //    row is now gone but the audit row survives — separate table,
  //    no FK.)
  const { error: updErr } = await admin
    .from("deleted_tenants_audit")
    .update({
      files_purged_count: filesPurged,
      files_purge_errors: purgeErrors.length > 0 ? purgeErrors.join(" | ") : null,
    })
    .eq("original_tenant_id", t.id);
  if (updErr) {
    logger.error("[cron/process-tenant-deletions] audit update failed (deletion still succeeded)", {
      tenant_id: t.id, err: updErr,
    });
  }

  return { files_purged: filesPurged, files_purge_errors: purgeErrors.length > 0 ? purgeErrors.join(" | ") : null };
}

async function purgeBucketForTenant(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  tenantId: string,
): Promise<number> {
  let total = 0;
  let offset = 0;
  // List in batches; Supabase Storage list() returns up to 1000 per call.
  while (true) {
    const { data: files, error } = await admin.storage
      .from(bucket)
      .list(tenantId, { limit: 1000, offset });
    if (error) throw new Error(error.message);
    if (!files || files.length === 0) break;

    const paths = files.map((f) => `${tenantId}/${f.name}`);
    const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
    if (rmErr) throw new Error(rmErr.message);
    total += paths.length;

    if (files.length < 1000) break;
    offset += 1000;
  }
  return total;
}
