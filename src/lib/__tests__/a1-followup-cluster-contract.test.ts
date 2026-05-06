/**
 * A1 followup cluster — contract tests.
 *
 * One-file contract pin for the cluster-PR migrations (items 1 + 9)
 * and the app-level shape changes that don't already have a dedicated
 * test file. Source-text grep — same approach as
 * a1-rpc-shape-contract.test.ts. The migrations themselves are
 * applied to prod via the Mgmt API at PR-open time; these tests
 * guarantee the file shape doesn't regress.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "..");

function read(...rel: string[]): string {
  return fs.readFileSync(path.resolve(ROOT, ...rel), "utf8");
}

describe("Cluster item 1 — audit_sensitive_changes singular entity_type", () => {
  const SQL = read(
    "supabase",
    "migrations",
    "20260506_audit_singular_entity_type.sql",
  );

  it("CREATE OR REPLACE FUNCTION audit_sensitive_changes (no DROP)", () => {
    expect(SQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.audit_sensitive_changes/,
    );
    // Don't drop the function — triggers are bound to it.
    expect(SQL).not.toMatch(/DROP FUNCTION/);
  });

  it("maps the 5 most-evidenced plurals to singular forms", () => {
    // Surfaced in R-0003 audit_logs query. If the map drops one, the
    // /settings/activity dropdown silently regresses.
    expect(SQL).toMatch(/WHEN 'sales'\s+THEN 'sale'/);
    expect(SQL).toMatch(/WHEN 'refunds'\s+THEN 'refund'/);
    expect(SQL).toMatch(/WHEN 'tasks'\s+THEN 'task'/);
    expect(SQL).toMatch(/WHEN 'expenses'\s+THEN 'expense'/);
    expect(SQL).toMatch(/WHEN 'locations'\s+THEN 'location'/);
  });

  it("emits singular-form action AND entity_type (not raw TG_TABLE_NAME)", () => {
    // The INSERT must use v_singular for both columns, not TG_TABLE_NAME.
    expect(SQL).toMatch(/v_singular \|\| '\.' \|\| lower\(TG_OP\)/);
    expect(SQL).not.toMatch(
      /TG_TABLE_NAME \|\| '\.' \|\| lower\(TG_OP\)/,
    );
  });
});

describe("Cluster item 9 — process_refund_v2 reference FK", () => {
  const SQL = read(
    "supabase",
    "migrations",
    "20260506_a1_v2_refund_stock_fk.sql",
  );

  it("INSERT into stock_movements includes reference_type + reference_id", () => {
    expect(SQL).toMatch(/INSERT INTO public\.stock_movements/);
    expect(SQL).toMatch(/reference_type, reference_id/);
    expect(SQL).toMatch(/'refund', v_refund_id/);
  });

  it("preserves the existing notes column and Refund <number> format", () => {
    expect(SQL).toMatch(/'Refund ' \|\| v_refund_number/);
  });
});

describe("Cluster item 2 — ActivityLogClient ENTITY_LABELS", () => {
  const SRC = read(
    "src",
    "app",
    "(app)",
    "settings",
    "activity",
    "ActivityLogClient.tsx",
  );

  it("includes singular keys for the trigger surface", () => {
    for (const k of [
      "sale:",
      "refund:",
      "payment:",
      "stock_movement:",
      "gl_entry:",
      "task:",
      "expense:",
      "location:",
    ]) {
      expect(SRC).toContain(k);
    }
  });

  it("includes plural aliases (defensive for legacy rows pre item 1)", () => {
    for (const k of [
      "sales:",
      "refunds:",
      "tasks:",
      "expenses:",
      "stock_movements:",
    ]) {
      expect(SRC).toContain(k);
    }
  });
});

describe("Cluster item 5 — FinanceHubClient currency precision", () => {
  const SRC = read(
    "src",
    "app",
    "(app)",
    "financials",
    "FinanceHubClient.tsx",
  );

  it("uses 2-decimal precision (not maximumFractionDigits: 0)", () => {
    expect(SRC).toMatch(/maximumFractionDigits:\s*2/);
    expect(SRC).toMatch(/minimumFractionDigits:\s*2/);
    // Only fail when an active code line uses :0 — comments
    // referencing the bug history are fine. Match just the JS object
    // form `: 0,` (with newline) so trailing commas + whitespace
    // distinguish code from prose.
    const codeLineWithZero = /maximumFractionDigits:\s*0[\s,}]/.exec(
      // Strip line comments so the bug history doesn't false-match.
      SRC.replace(/\/\/[^\n]*/g, ""),
    );
    expect(codeLineWithZero).toBeNull();
  });
});

describe("Cluster item 10 — refund v2 audit log metadata.flowVersion", () => {
  const SRC = read("src", "app", "(app)", "refunds", "actions.ts");

  it("emits flowVersion='v2' under metadata, not newData", () => {
    // Match a logAuditEvent call shape with metadata: { flowVersion: 'v2'… }
    expect(SRC).toMatch(
      /metadata:\s*\{[\s\S]{0,80}?flowVersion:\s*["']v2["']/,
    );
  });
});
