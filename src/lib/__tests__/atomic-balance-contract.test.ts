import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Static contract test for the atomic store-credit + voucher migration.
 * Audit finding (High): POS deducted balances with an optimistic
 * compare-and-swap, which could race and go negative or double-redeem.
 * Migration 20260421_atomic_store_credit_voucher.sql replaces that
 * with DB-side SELECT FOR UPDATE functions + CHECK constraint.
 *
 * Lock the migration shape so a future refactor can't remove the
 * lock or weaken the balance guarantee.
 */
const migration = fs.readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/20260421_atomic_store_credit_voucher.sql"),
  "utf8",
);

describe("atomic balance migration contract", () => {
  it("adds a CHECK ≥ 0 constraint on customers.store_credit", () => {
    expect(migration).toMatch(/CONSTRAINT customers_store_credit_nonneg/);
    expect(migration).toMatch(/CHECK\s*\(\s*COALESCE\(store_credit, 0\)\s*>=\s*0\s*\)/);
  });

  it("deduct_store_credit uses SELECT FOR UPDATE", () => {
    expect(migration).toMatch(/FUNCTION public\.deduct_store_credit/);
    expect(migration).toMatch(/FROM customers[\s\S]*FOR UPDATE/);
  });

  it("deduct_store_credit raises on insufficient balance", () => {
    expect(migration).toMatch(/RAISE EXCEPTION 'insufficient_store_credit'/);
  });

  it("redeem_voucher uses SELECT FOR UPDATE", () => {
    expect(migration).toMatch(/FUNCTION public\.redeem_voucher/);
    expect(migration).toMatch(/FROM gift_vouchers[\s\S]*FOR UPDATE/);
  });

  it("redeem_voucher rejects inactive or insufficient vouchers", () => {
    expect(migration).toMatch(/RAISE EXCEPTION 'voucher_not_active'/);
    expect(migration).toMatch(/RAISE EXCEPTION 'insufficient_voucher_balance'/);
  });

  it("voucher flips to 'redeemed' when balance hits zero", () => {
    expect(migration).toMatch(/status = CASE WHEN v_new <= 0 THEN 'redeemed' ELSE 'active' END/);
  });

  it("both functions are SECURITY DEFINER + restricted to service_role", () => {
    expect(migration).toMatch(/SECURITY DEFINER/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.deduct_store_credit[^;]*service_role/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.redeem_voucher[^;]*service_role/);
  });

  it("revokes execute from anon/authenticated (least privilege)", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.deduct_store_credit[^;]*anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.redeem_voucher[^;]*anon, authenticated/);
  });
});
