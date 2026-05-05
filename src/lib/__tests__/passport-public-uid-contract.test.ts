import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-10 Phase 1: passport public_uid.
 *
 * Audit: enumerable sequential passport_uid (= identity_number
 * stringified, starting at 100000001) let external actors iterate
 * /verify/[uid] across all tenants. Phase 1 introduces an
 * unguessable UUID v4 public_uid, wires it into the verify ladder
 * + share URLs + QR codes, and audits legacy hits so the 90-day
 * sunset (2026-08-05) is data-driven.
 *
 * Phase 1 invariants pinned by this test.
 */

const migrationFile = fs.readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/20260505_add_passport_public_uid.sql"),
  "utf8",
);

const createAction = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/passports/actions.ts"),
  "utf8",
);

const staffVerifyAction = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/passports/verify/actions.ts"),
  "utf8",
);

const publicVerifyPage = fs.readFileSync(
  path.resolve(__dirname, "../../app/verify/[uid]/page.tsx"),
  "utf8",
);

const pdfRoute = fs.readFileSync(
  path.resolve(__dirname, "../../app/api/passport/[id]/pdf/route.ts"),
  "utf8",
);

const backfillScript = fs.readFileSync(
  path.resolve(__dirname, "../../../scripts/backfill-passport-public-uids.ts"),
  "utf8",
);

describe("M-10 migration", () => {
  it("adds passports.public_uid TEXT", () => {
    expect(migrationFile).toMatch(/ALTER TABLE public\.passports[\s\S]*?ADD COLUMN[\s\S]*?public_uid[\s\S]*?TEXT/i);
  });

  it("adds a partial unique index on public_uid (NULL allowed during backfill)", () => {
    expect(migrationFile).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*?passports_public_uid_unique[\s\S]*?WHERE\s+public_uid\s+IS\s+NOT\s+NULL/i,
    );
  });

  it("creates passport_legacy_lookups audit table", () => {
    expect(migrationFile).toMatch(/CREATE TABLE[\s\S]*?passport_legacy_lookups/i);
    expect(migrationFile).toMatch(/lookup_form\s+TEXT[\s\S]*?CHECK[\s\S]*?legacy_nxp[\s\S]*?legacy_numeric/i);
  });

  it("enables RLS on passport_legacy_lookups", () => {
    expect(migrationFile).toMatch(/passport_legacy_lookups\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it("documents the 2026-08-05 sunset window in column comment", () => {
    expect(migrationFile).toMatch(/2026-08-05/);
  });
});

describe("createPassport — generates public_uid via crypto.randomUUID", () => {
  it("imports randomUUID from node:crypto (no ulid dep)", () => {
    expect(createAction).toMatch(/import\s+\{\s*randomUUID\s*\}\s+from\s+["']node:crypto["']/);
    // Joey's decision — no ulid dep.
    expect(createAction).not.toMatch(/from\s+["']ulid["']/);
  });

  it("calls randomUUID() and assigns to publicUid", () => {
    expect(createAction).toMatch(/const\s+publicUid\s*=\s*randomUUID\(\)/);
  });

  it("inserts public_uid alongside legacy passport_uid + identity_number", () => {
    const insertBlock = createAction.match(
      /\.from\("passports"\)\s*\.insert\(\{[\s\S]{0,2000}?\}\)/,
    );
    expect(insertBlock).not.toBeNull();
    expect(insertBlock?.[0]).toMatch(/public_uid:\s*publicUid/);
    expect(insertBlock?.[0]).toMatch(/passport_uid:\s*passportUid/);
    expect(insertBlock?.[0]).toMatch(/identity_number:\s*identityNumber/);
  });
});

describe("staff /passports/verify action — accepts public_uid first", () => {
  it("includes public_uid in the SELECT columns", () => {
    expect(staffVerifyAction).toMatch(/public_uid/);
  });

  it("checks UUID v4 form before querying public_uid", () => {
    expect(staffVerifyAction).toMatch(
      /\/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i\.test\(serial\)/,
    );
  });
});

describe("public /verify/[uid] page — public_uid + audit-logged legacy ladder", () => {
  it("declares UUID + legacy_nxp + legacy_numeric format constants", () => {
    expect(publicVerifyPage).toMatch(/UUID_V4_RE/);
    expect(publicVerifyPage).toMatch(/LEGACY_NXP_RE/);
    expect(publicVerifyPage).toMatch(/LEGACY_NUMERIC_RE/);
  });

  it("classifies the lookup form before query", () => {
    expect(publicVerifyPage).toMatch(/classifyLookupForm/);
  });

  it("queries public_uid first when input matches UUID v4", () => {
    expect(publicVerifyPage).toMatch(
      /lookupForm\s*===\s*"public_uid"[\s\S]{0,400}\.ilike\("public_uid"/,
    );
  });

  it("inserts a passport_legacy_lookups audit row on legacy hits", () => {
    expect(publicVerifyPage).toMatch(/passport_legacy_lookups/);
    expect(publicVerifyPage).toMatch(/lookup_form:\s*lookupForm/);
  });
});

describe("PDF route — QR data prefers public_uid", () => {
  it("passport_uid + id remain as fallbacks", () => {
    expect(pdfRoute).toMatch(
      /passportNumber:\s*passport\.public_uid\s*\?\?\s*passport\.passport_uid\s*\?\?\s*passport\.id/,
    );
  });
});

describe("backfill script", () => {
  it("imports randomUUID + creates a Supabase admin client", () => {
    expect(backfillScript).toMatch(/import\s+\{\s*randomUUID\s*\}\s+from\s+["']node:crypto["']/);
    expect(backfillScript).toMatch(/createClient\(url,\s*serviceKey/);
  });

  it("only updates rows where public_uid IS NULL (idempotent)", () => {
    expect(backfillScript).toMatch(/\.is\("public_uid",\s*null\)/);
    // Update path also re-asserts the IS NULL check to win the race
    // between fetchPage and the update batch.
    const updateBlock = backfillScript.match(
      /\.update\(\{[\s\S]{0,200}\}\)[\s\S]{0,200}\.is\("public_uid",\s*null\)/,
    );
    expect(updateBlock).not.toBeNull();
  });

  it("supports --dry-run without writing", () => {
    expect(backfillScript).toMatch(/--dry-run/);
    expect(backfillScript).toMatch(/DRY_RUN/);
  });
});
