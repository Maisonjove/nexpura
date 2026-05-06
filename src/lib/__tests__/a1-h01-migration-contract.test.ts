/**
 * A1 Day 4 — H-01 migration shape contract.
 *
 * Pins the SQL invariants from
 * supabase/migrations/20260506_a1_h01_cost_at_sale_completed_at.sql.
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
    "20260506_a1_h01_cost_at_sale_completed_at.sql",
  ),
  "utf8",
);

describe("A1 H-01 migration — sale_items.cost_at_sale", () => {
  it("adds cost_at_sale NUMERIC(12,2) nullable", () => {
    expect(SQL).toMatch(
      /ALTER TABLE public\.sale_items[\s\S]+?ADD COLUMN IF NOT EXISTS\s+cost_at_sale\s+NUMERIC\(12,2\)/i,
    );
  });

  it("backfills cost_at_sale from inventory.cost_price (idempotent)", () => {
    expect(SQL).toMatch(
      /UPDATE public\.sale_items si[\s\S]+?SET cost_at_sale = inv\.cost_price[\s\S]+?WHERE si\.inventory_id = inv\.id[\s\S]+?si\.cost_at_sale IS NULL/i,
    );
  });

  it("documents the snapshot semantics in a column comment", () => {
    expect(SQL).toMatch(
      /COMMENT ON COLUMN public\.sale_items\.cost_at_sale[\s\S]+?NEVER mutated by retroactive/i,
    );
  });

  it("creates a partial index on (sale_id) where cost_at_sale IS NOT NULL", () => {
    expect(SQL).toMatch(
      /CREATE INDEX IF NOT EXISTS sale_items_cost_at_sale_partial_idx[\s\S]+?WHERE cost_at_sale IS NOT NULL/i,
    );
  });
});

describe("A1 H-01 migration — sales.completed_at", () => {
  it("adds completed_at TIMESTAMPTZ nullable", () => {
    expect(SQL).toMatch(
      /ALTER TABLE public\.sales[\s\S]+?ADD COLUMN IF NOT EXISTS\s+completed_at\s+TIMESTAMPTZ/i,
    );
  });

  it("backfills completed_at from updated_at for paid/completed sales", () => {
    expect(SQL).toMatch(
      /UPDATE public\.sales[\s\S]+?SET completed_at = updated_at[\s\S]+?status IN \('paid', 'completed'\)/i,
    );
  });

  it("creates a partial index on (tenant_id, completed_at) where completed_at IS NOT NULL", () => {
    expect(SQL).toMatch(
      /CREATE INDEX IF NOT EXISTS sales_completed_at_partial_idx[\s\S]+?\(tenant_id, completed_at\)[\s\S]+?WHERE completed_at IS NOT NULL/i,
    );
  });
});

describe("A1 H-01 migration — transactional + idempotent", () => {
  it("wraps in BEGIN/COMMIT", () => {
    expect(SQL).toMatch(/^\s*BEGIN;/m);
    expect(SQL).toMatch(/COMMIT;\s*$/);
  });

  it("uses IF NOT EXISTS on every column add for idempotency", () => {
    const adds = SQL.match(/ADD COLUMN/gi) ?? [];
    const safeAdds = SQL.match(/ADD COLUMN IF NOT EXISTS/gi) ?? [];
    expect(adds.length).toBe(safeAdds.length);
  });
});
