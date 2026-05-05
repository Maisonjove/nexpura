/**
 * Unit test for the decideBackfillStatus + formatBackfillMessage
 * helpers exported from scripts/backfill-team-members-c02.ts.
 *
 * Background: pre-#197 the backfill script collapsed
 * "would-have-been-inserted" with "already-exists" in dry-run mode,
 * which hid the fact that 10 owners had no team_members row when the
 * 2026-05-05 wave-4 backfill ran. #197 fixed the bug; #198 (this
 * follow-up) extends the fix to the canonical 4-state vocabulary
 * (per CONTRIBUTING.md §16) and pins the state machine + reporter
 * shape in tests so regressions can't recur.
 */
import { describe, it, expect } from "vitest";
import {
  decideBackfillStatus,
  formatBackfillMessage,
  type BackfillResult,
} from "../../../scripts/backfill-c02-decider";

describe("decideBackfillStatus — 4-state matrix", () => {
  it("(no row, dry-run) → would_insert", () => {
    expect(decideBackfillStatus(null, true)).toBe("would_insert");
  });

  it("(no row, write) → inserted", () => {
    // The decider reports the planned outcome; the side-effect path
    // (the actual insert) might still fail and be re-mapped, but the
    // initial decision is "inserted".
    expect(decideBackfillStatus(null, false)).toBe("inserted");
  });

  it("(row exists, dry-run) → exists", () => {
    expect(decideBackfillStatus("existing-row-uuid", true)).toBe("exists");
  });

  it("(row exists, write) → skip_exists", () => {
    expect(decideBackfillStatus("existing-row-uuid", false)).toBe("skip_exists");
  });

  it("never collapses dry-run states with write states", () => {
    // The pre-fix bug was: dry-run + no-row produced the same status
    // string as write + row-exists. This pin proves the four states
    // are pairwise distinct.
    const states = new Set([
      decideBackfillStatus(null, true),
      decideBackfillStatus(null, false),
      decideBackfillStatus("x", true),
      decideBackfillStatus("x", false),
    ]);
    expect(states.size).toBe(4);
  });
});

describe("formatBackfillMessage — distinct strings per state", () => {
  const ctx = { user_email: "owner@example.com", tenant_id: "tenant-uuid" };

  function r(over: Partial<BackfillResult>): BackfillResult {
    return { status: "inserted", existing: null, insertedId: null, ...over };
  }

  it("'inserted' includes the new row id", () => {
    const msg = formatBackfillMessage(r({ status: "inserted", insertedId: "new-uuid" }), ctx);
    expect(msg).toMatch(/inserted row=new-uuid/);
    expect(msg).toMatch(/owner@example\.com/);
    expect(msg).toMatch(/tenant-uuid/);
    expect(msg).not.toMatch(/already exists/i);
    expect(msg).not.toMatch(/would insert/i);
  });

  it("'would_insert' is loud about being a dry-run plan", () => {
    const msg = formatBackfillMessage(r({ status: "would_insert" }), ctx);
    expect(msg).toMatch(/WOULD INSERT/);
    expect(msg).toMatch(/dry-run/);
    expect(msg).toMatch(/existence check confirmed missing/);
    expect(msg).not.toMatch(/already exists/i);
  });

  it("'exists' (dry-run + duplicate) names the existing id", () => {
    const msg = formatBackfillMessage(
      r({ status: "exists", existing: "existing-uuid" }),
      ctx,
    );
    expect(msg).toMatch(/already exists id=existing-uuid/);
    expect(msg).toMatch(/dry-run/);
  });

  it("'skip_exists' (write + duplicate) names the existing id and does NOT say dry-run", () => {
    const msg = formatBackfillMessage(
      r({ status: "skip_exists", existing: "existing-uuid" }),
      ctx,
    );
    expect(msg).toMatch(/already exists id=existing-uuid/);
    expect(msg).not.toMatch(/dry-run/);
  });

  it("messages are pairwise distinct (regression guard for the pre-#197 bug)", () => {
    // The whole point of the fix: each of the four states gets its
    // own line. If two states ever collapse to the same string,
    // dry-run output starts lying again.
    const msgs = new Set([
      formatBackfillMessage(r({ status: "inserted", insertedId: "x" }), ctx),
      formatBackfillMessage(r({ status: "would_insert" }), ctx),
      formatBackfillMessage(r({ status: "exists", existing: "x" }), ctx),
      formatBackfillMessage(r({ status: "skip_exists", existing: "x" }), ctx),
    ]);
    expect(msgs.size).toBe(4);
  });
});
