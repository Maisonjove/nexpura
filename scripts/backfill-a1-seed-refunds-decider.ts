/**
 * Pure decider + reporter for the A1 seed-refund backfill script.
 * Same 4-state vocabulary as scripts/backfill-c02-decider.ts (per
 * CONTRIBUTING.md §16); side-effect-free for unit-test reach.
 *
 * Source-of-truth template for any new backfill: copy this file +
 * the 4-state outcome contract, swap the messages.
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

export function decideBackfillStatus(
  existingRowId: string | null,
  isDryRun: boolean,
): BackfillStatus {
  if (existingRowId) return isDryRun ? "exists" : "skip_exists";
  return isDryRun ? "would_insert" : "inserted";
}

export function formatBackfillMessage(
  result: BackfillResult,
  ctx: { sale_id: string; tenant_id: string },
): string {
  const sid = ctx.sale_id.slice(0, 8);
  switch (result.status) {
    case "inserted":
      return `[backfill-a1-seed] inserted refund=${result.insertedId} for sale=${sid} (tenant=${ctx.tenant_id.slice(0, 8)})`;
    case "would_insert":
      return `[backfill-a1-seed] WOULD INSERT for sale=${sid} (dry-run; existence check confirmed missing)`;
    case "exists":
      return `[backfill-a1-seed] would skip sale=${sid}: refund already exists id=${result.existing} (dry-run)`;
    case "skip_exists":
      return `[backfill-a1-seed] skipped sale=${sid}: refund already exists id=${result.existing}`;
  }
}
