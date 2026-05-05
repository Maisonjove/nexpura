/**
 * Contract test for the C-05 activity-log triggers migration.
 *
 * We don't have psql available in CI, so this is a static-analysis
 * test against the migration file. Locks in:
 *   - the trigger function exists, is SECURITY DEFINER, sets search_path
 *   - the wrapper-shadow guard (`audit.skip` GUC) is honoured
 *   - the documented allow-list of tables is applied
 *   - the documented deny-list is NOT applied
 *   - idempotent (DROP IF EXISTS) so re-run is safe
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../../supabase/migrations/20260505_activity_log_triggers.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("activity_log triggers migration (C-05)", () => {
  it("redefines audit_sensitive_changes as SECURITY DEFINER", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.audit_sensitive_changes/);
    expect(sql).toMatch(/SECURITY DEFINER/);
  });

  it("pins search_path to public (CVE hardening)", () => {
    expect(sql).toMatch(/SET search_path = public/);
  });

  it("honours the audit.skip GUC for wrapper-shadow suppression", () => {
    // The route-level wrapper sets audit.skip before its own write so
    // we don't double-emit. The trigger MUST early-return when this is
    // 'true'.
    expect(sql).toMatch(/current_setting\('audit\.skip', true\)/);
    expect(sql).toMatch(/v_skip = 'true'/);
  });

  it("defends against NULL request.headers (server-action call sites)", () => {
    // Previous version crashed when called from psql / server actions
    // because request.headers was NULL and ::json failed.
    expect(sql).toMatch(/request\.headers/);
    expect(sql).toMatch(/v_headers IS NOT NULL/);
  });

  it("emits TG_TABLE_NAME-prefixed action for filterability", () => {
    expect(sql).toMatch(/TG_TABLE_NAME \|\| '\.' \|\| lower\(TG_OP\)/);
  });

  it("tags trigger rows with metadata.source = 'db_trigger'", () => {
    // Lets the UI distinguish wrapper rows (rich) from trigger rows
    // (safety-net) without an extra column.
    expect(sql).toMatch(/'source', 'db_trigger'/);
  });

  it("applies triggers to the documented allow-list of tables", () => {
    const allowList = [
      "sales",
      "sale_items",
      "inventory",
      "repairs",
      "bespoke_jobs",
      "team_members",
      "locations",
      "suppliers",
      "expenses",
      "quotes",
      "gift_vouchers",
      "tasks",
      "appointments",
    ];
    for (const t of allowList) {
      // Each appears as a string element in the tables array.
      expect(sql).toContain(`'${t}'`);
    }
  });

  it("does NOT apply triggers to deny-listed (noisy) tables", () => {
    const denyList = [
      "audit_logs", // recursion
      "rate_limit_buckets", // operational noise
      "tenant_dashboard_stats", // derived
      "notifications", // message bus
      "sms_sends",
      "whatsapp_sends",
      "email_sends",
      "stock_movements",
    ];
    // We grep for `'<table>'` inside the tables array — the migration
    // documents these in a comment but must NOT include them in the
    // CREATE TRIGGER loop. Trick: inspect the body of `tables text[]`.
    const tablesArrayMatch = sql.match(/tables text\[\] := ARRAY\[([\s\S]*?)\]/);
    expect(tablesArrayMatch).not.toBeNull();
    const arrayBody = tablesArrayMatch![1];
    for (const t of denyList) {
      expect(arrayBody).not.toContain(`'${t}'`);
    }
  });

  it("is idempotent (DROP TRIGGER IF EXISTS before CREATE)", () => {
    // Re-running the migration must not fail.
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS/);
  });

  it("creates the (tenant_id, created_at desc) index for the activity feed", () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx/
    );
    expect(sql).toMatch(/audit_logs.*tenant_id.*created_at DESC/s);
  });

  it("wraps the work in BEGIN/COMMIT (atomic apply)", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });
});
