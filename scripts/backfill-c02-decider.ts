/**
 * Pure decider + reporter for the C-02 backfill script. Lives in its
 * own module so unit tests can import it without triggering the
 * sibling script's env-var check + Supabase client init at module
 * load time.
 *
 * See scripts/backfill-team-members-c02.ts for the call site and
 * CONTRIBUTING.md §16 for the canonical 4-state semantic.
 */

/**
 * Four states a backfill row resolves into. Pin the exact 4-state
 * vocabulary so dry-run vs WRITE outputs stay distinguishable from
 * each other AND from genuine no-ops.
 *
 *   would_insert  — DRY-RUN, existence check confirmed MISSING.
 *                   WRITE would insert.
 *   exists        — DRY-RUN, existence check found a duplicate.
 *                   WRITE would skip.
 *   inserted      — WRITE, existence check confirmed MISSING.
 *                   Row was just written.
 *   skip_exists   — WRITE, existence check found a duplicate.
 *                   Row was left alone.
 *
 * The pre-#197 version of the script collapsed `would_insert` and
 * `skip_exists` into a single "already exists" report, which hid the
 * fact that 10 owners had no team_members row.
 */
export type BackfillStatus =
  | "would_insert"
  | "exists"
  | "inserted"
  | "skip_exists";

export interface BackfillResult {
  status: BackfillStatus;
  /** existing row id when status is "exists" or "skip_exists"; else null */
  existing: string | null;
  /** new row id when status is "inserted"; else null */
  insertedId: string | null;
  error?: string;
}

/**
 * Pure decider. Translates the (existing-row-found, dry-run-mode)
 * tuple into the 4-state BackfillStatus so the reporter (and tests)
 * can rely on a single source of truth for which outcome each
 * combination produces.
 */
export function decideBackfillStatus(
  existingRowId: string | null,
  isDryRun: boolean,
): BackfillStatus {
  if (existingRowId) return isDryRun ? "exists" : "skip_exists";
  return isDryRun ? "would_insert" : "inserted";
}

/**
 * Pure reporter. Returns the line that the script's main() will
 * print for a given result. Distinct strings per state so dry-run
 * vs write output is unambiguous.
 */
export function formatBackfillMessage(
  result: BackfillResult,
  ctx: { user_email: string; tenant_id: string },
): string {
  switch (result.status) {
    case "inserted":
      return `[backfill-c02] inserted row=${result.insertedId} for ${ctx.user_email} → ${ctx.tenant_id}`;
    case "would_insert":
      return `[backfill-c02] WOULD INSERT ${ctx.user_email} → ${ctx.tenant_id} (dry-run; existence check confirmed missing)`;
    case "exists":
      return `[backfill-c02] would skip ${ctx.user_email} → ${ctx.tenant_id}: row already exists id=${result.existing} (dry-run)`;
    case "skip_exists":
      return `[backfill-c02] skipped ${ctx.user_email} → ${ctx.tenant_id}: row already exists id=${result.existing}`;
  }
}
