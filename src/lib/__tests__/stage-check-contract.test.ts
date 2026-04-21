import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for stage CHECK constraint migration. Audit finding
 * (High): repairs.stage + bespoke_jobs.stage were unchecked TEXT — a
 * typo or direct DB update could land stage='reafy' or skip stage
 * sequence. Migration 20260421_stage_check_constraints.sql adds
 * CHECK constraints restricting both columns to enumerated values.
 */

const migration = fs.readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/20260421_stage_check_constraints.sql"),
  "utf8",
);

describe("stage CHECK constraint migration (HIGH)", () => {
  it("adds a CHECK constraint on repairs.stage", () => {
    expect(migration).toMatch(/ALTER TABLE public\.repairs[\s\S]*CONSTRAINT repairs_stage_valid/);
    expect(migration).toMatch(/CHECK \(stage IN[\s\S]*?\)/);
  });

  it("adds a CHECK constraint on bespoke_jobs.stage", () => {
    expect(migration).toMatch(/ALTER TABLE public\.bespoke_jobs[\s\S]*CONSTRAINT bespoke_jobs_stage_valid/);
  });

  it("accepts the observed live values for repairs", () => {
    for (const s of ["intake", "in_progress", "ready", "completed", "cancelled"]) {
      expect(migration).toMatch(new RegExp(`'${s}'`));
    }
  });

  it("accepts the observed live values for bespoke_jobs", () => {
    for (const s of ["enquiry", "consultation", "design", "approved", "delivered", "cancelled"]) {
      expect(migration).toMatch(new RegExp(`'${s}'`));
    }
  });

  it("uses IDEMPOTENT DROP IF EXISTS before CREATE so re-runs don't fail", () => {
    expect(migration).toMatch(/DROP CONSTRAINT IF EXISTS repairs_stage_valid/);
    expect(migration).toMatch(/DROP CONSTRAINT IF EXISTS bespoke_jobs_stage_valid/);
  });
});
