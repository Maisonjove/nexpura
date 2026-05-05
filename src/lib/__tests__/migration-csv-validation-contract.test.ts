import { describe, it, expect } from "vitest";
import {
  validateMappingCoverage,
  CUSTOMER_REQUIRED_COVERAGE,
  INVENTORY_REQUIRED_COVERAGE,
  REPAIR_REQUIRED_COVERAGE,
  type MappingEntry,
} from "@/lib/migration/engine";

/**
 * Unit tests for the M-12 column-coverage validator.
 *
 * Audit: "Migration CSV column validation." Pre-fix, the only
 * feedback for a CSV missing required columns was per-row errors
 * surfaced during the actual import — the user had already paid the
 * upload + map + click-Preview cost on a structurally wrong CSV.
 *
 * Post-fix: validateMappingCoverage runs in the preview route and
 * returns ok=false + a list of unsatisfied required-coverage buckets
 * BEFORE the user clicks Import.
 */

function mappings(...dests: string[]): MappingEntry[] {
  return dests.map((d, i) => ({
    sourceColumn: `col_${i}`,
    destinationField: d,
  }));
}

describe("validateMappingCoverage — entity-specific required coverage", () => {
  it("flags customer imports with no name/email/phone mapping", () => {
    const r = validateMappingCoverage("customers", mappings("notes"));
    expect(r.ok).toBe(false);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0].bucket.label).toMatch(/Name, email, or phone/);
  });

  it("accepts customer imports with email mapped", () => {
    const r = validateMappingCoverage("customers", mappings("email"));
    expect(r.ok).toBe(true);
    expect(r.missing).toHaveLength(0);
  });

  it("accepts customer imports with first_name + last_name (any-of bucket)", () => {
    const r = validateMappingCoverage("customers", mappings("first_name", "last_name"));
    expect(r.ok).toBe(true);
  });

  it("flags inventory imports with no name AND no sku", () => {
    const r = validateMappingCoverage("inventory", mappings("retail_price"));
    expect(r.ok).toBe(false);
    expect(r.missing[0].bucket.label).toMatch(/name or SKU/i);
  });

  it("accepts inventory imports with sku mapped", () => {
    const r = validateMappingCoverage("inventory", mappings("sku"));
    expect(r.ok).toBe(true);
  });

  it("flags repair imports with no item_description AND no item_type", () => {
    const r = validateMappingCoverage("repairs", mappings("customer_email"));
    expect(r.ok).toBe(false);
    expect(r.missing[0].bucket.label).toMatch(/item description or item type/i);
  });

  it("treats bespoke entity the same as repairs", () => {
    const r = validateMappingCoverage("bespoke", mappings("customer_email"));
    expect(r.ok).toBe(false);
  });

  it("returns ok=true for unknown entity (caller surfaces 'not detected')", () => {
    const r = validateMappingCoverage("unknown", mappings("foo"));
    expect(r.ok).toBe(true);
    expect(r.missing).toHaveLength(0);
  });

  it("returns the unmappedDestOptions for surfacing in the UI", () => {
    const r = validateMappingCoverage("customers", []);
    expect(r.missing[0].unmappedDestOptions).toEqual(
      expect.arrayContaining(["full_name", "email", "mobile"]),
    );
  });
});

describe("required-coverage shape", () => {
  it("CUSTOMER_REQUIRED_COVERAGE has at least one bucket", () => {
    expect(CUSTOMER_REQUIRED_COVERAGE.length).toBeGreaterThan(0);
  });
  it("INVENTORY_REQUIRED_COVERAGE has at least one bucket", () => {
    expect(INVENTORY_REQUIRED_COVERAGE.length).toBeGreaterThan(0);
  });
  it("REPAIR_REQUIRED_COVERAGE has at least one bucket", () => {
    expect(REPAIR_REQUIRED_COVERAGE.length).toBeGreaterThan(0);
  });
});
