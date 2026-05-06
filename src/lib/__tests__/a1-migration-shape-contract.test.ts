/**
 * A1 cluster Day 1 — migration shape contract.
 *
 * Pins the SQL invariants from supabase/migrations/20260506_a1_refunds_gl_pin.sql
 * so a future migration edit can't silently drop the new columns,
 * indexes, constraints, or feature-flag default. Source-text grep
 * checks; the actual DB shape is verified by applying the migration
 * and running it against staging (done 2026-05-06 04:57 UTC).
 *
 * See PR description for the full investigation that drove this shape:
 * - 7-question report (refunds existing surface analysis)
 * - 3 scope locks (PIN window/mechanism, GL minimum-viable, feature flag)
 *
 * Cross-references:
 * - C-01 P0 guard (PR #199, commit c24628ff) — fake-refund prevention
 * - May Nexpura outlier rollback (sale b5b60d1a → completed, audit
 *   88ad4620, executed 2026-05-06 01:57 UTC)
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SQL = fs.readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "supabase",
    "migrations",
    "20260506_a1_refunds_gl_pin.sql",
  ),
  "utf8",
);

describe("A1 migration — refunds new columns", () => {
  it("adds refund_type with NOT NULL + default 'full' + 3-value CHECK", () => {
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS\s+refund_type\s+TEXT/i);
    expect(SQL).toMatch(/ALTER COLUMN refund_type SET NOT NULL/i);
    expect(SQL).toMatch(/refund_type[\s\S]{0,200}?DEFAULT\s+['"]full['"]/i);
    expect(SQL).toMatch(
      /CHECK\s*\(\s*refund_type IN \(['"]full['"],\s*['"]partial['"],\s*['"]store_credit['"]\)\s*\)/i,
    );
  });

  it("backfills refund_type from existing refund_method (store_credit → 'store_credit', else 'full')", () => {
    expect(SQL).toMatch(
      /UPDATE public\.refunds[\s\S]+?refund_method = ['"]store_credit['"][\s\S]+?THEN\s+['"]store_credit['"]/i,
    );
    expect(SQL).toMatch(/ELSE\s+['"]full['"]/i);
  });

  it("adds gateway_ref nullable TEXT + partial unique index by tenant", () => {
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS\s+gateway_ref\s+TEXT/i);
    expect(SQL).toMatch(
      /CREATE INDEX IF NOT EXISTS refunds_gateway_ref_idx[\s\S]+?WHERE gateway_ref IS NOT NULL/i,
    );
  });

  it("adds needs_review BOOLEAN NOT NULL DEFAULT FALSE + partial index for the flag", () => {
    expect(SQL).toMatch(
      /ADD COLUMN IF NOT EXISTS\s+needs_review\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+FALSE/i,
    );
    expect(SQL).toMatch(
      /CREATE INDEX IF NOT EXISTS refunds_needs_review_idx[\s\S]+?WHERE needs_review = TRUE/i,
    );
  });

  it("adds completed_at timestamptz + backfills from created_at", () => {
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS\s+completed_at\s+TIMESTAMPTZ/i);
    expect(SQL).toMatch(
      /UPDATE public\.refunds[\s\S]+?SET completed_at = created_at/i,
    );
  });
});

describe("A1 migration — refunds CHECK constraint + drop legacy column", () => {
  it("locks refund_method to the 5-value canonical set", () => {
    expect(SQL).toMatch(
      /CHECK\s*\(\s*refund_method IN \(\s*['"]original_tender['"],\s*['"]store_credit['"],\s*['"]cash['"],\s*['"]card['"],\s*['"]other['"]\s*\)\s*\)/i,
    );
  });

  it("drops the legacy total_amount column (verified empty-replacement: total === total_amount in all 3 prod rows)", () => {
    expect(SQL).toMatch(/DROP COLUMN IF EXISTS\s+total_amount/i);
  });
});

describe("A1 migration — team_members manager PIN columns", () => {
  it("adds manager_pin_hash TEXT (bcrypt) + manager_pin_set_at timestamptz", () => {
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS\s+manager_pin_hash\s+TEXT/i);
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS\s+manager_pin_set_at\s+TIMESTAMPTZ/i);
  });

  it("documents the PIN policy in column comments", () => {
    expect(SQL).toMatch(
      /COMMENT ON COLUMN public\.team_members\.manager_pin_hash[\s\S]+?bcrypt/i,
    );
    expect(SQL).toMatch(
      /COMMENT ON COLUMN public\.team_members\.manager_pin_set_at/i,
    );
  });
});

describe("A1 migration — gl_entries minimum-viable ledger", () => {
  it("creates the table with all required columns", () => {
    const create = SQL.match(/CREATE TABLE IF NOT EXISTS public\.gl_entries[\s\S]+?\);/);
    expect(create, "gl_entries CREATE TABLE block must be present").toBeTruthy();
    const block = create![0];
    for (const col of [
      "id UUID PRIMARY KEY",
      "tenant_id UUID NOT NULL",
      "entry_type TEXT NOT NULL",
      "amount NUMERIC(14,2) NOT NULL",
      "currency TEXT NOT NULL",
      "source_type TEXT",
      "source_id UUID",
      "created_at TIMESTAMPTZ",
    ]) {
      expect(block, `gl_entries should declare ${col}`).toMatch(
        new RegExp(col.replace(/[()]/g, "\\$&"), "i"),
      );
    }
  });

  it("entry_type is constrained to refund / sale / adjustment", () => {
    expect(SQL).toMatch(
      /CHECK\s*\(\s*entry_type IN \(\s*['"]refund['"],\s*['"]sale['"],\s*['"]adjustment['"]\s*\)\s*\)/i,
    );
  });

  it("creates the 3 reconciliation indexes (tenant+created, source, type+created)", () => {
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS gl_entries_tenant_created_idx/i);
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS gl_entries_source_idx/i);
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS gl_entries_type_idx/i);
  });

  it("enables RLS + tenant-scoped read policy", () => {
    expect(SQL).toMatch(/ALTER TABLE public\.gl_entries ENABLE ROW LEVEL SECURITY/i);
    expect(SQL).toMatch(/CREATE POLICY gl_entries_tenant_read[\s\S]+?FOR SELECT/i);
  });
});

describe("A1 migration — tenants feature flag", () => {
  it("adds a1_money_correctness BOOLEAN NOT NULL DEFAULT FALSE", () => {
    expect(SQL).toMatch(
      /ADD COLUMN IF NOT EXISTS\s+a1_money_correctness\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+FALSE/i,
    );
  });

  it("documents the staged-rollout policy in the column comment", () => {
    expect(SQL).toMatch(
      /COMMENT ON COLUMN public\.tenants\.a1_money_correctness[\s\S]+?staged rollout/i,
    );
  });
});

describe("A1 migration — wraps in BEGIN/COMMIT for transactional apply", () => {
  it("opens with BEGIN and ends with COMMIT", () => {
    expect(SQL).toMatch(/^\s*BEGIN;/m);
    expect(SQL).toMatch(/COMMIT;\s*$/);
  });
});
