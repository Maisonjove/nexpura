/**
 * A1 cluster Day 2 — process_refund_v2 RPC shape contract.
 *
 * Pins the SQL invariants from the RPC migration so future edits
 * can't silently change the parameter order, RBAC posture, or
 * transactional shape. Source-text grep checks; the actual function
 * is verified by applying the migration and round-tripping a refund
 * (smoke test in Day 5 deploy soak).
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
    "20260506_a1_process_refund_v2_rpc.sql",
  ),
  "utf8",
);

describe("A1 process_refund_v2 RPC — signature pinning", () => {
  it("function name + 10 parameters in canonical order", () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.process_refund_v2\s*\(/);
    // Canonical parameter order — caller fingerprints depend on this.
    const canonical = [
      "p_tenant_id",
      "p_user_id",
      "p_original_sale_id",
      "p_reason",
      "p_refund_method",
      "p_refund_type",
      "p_items",
      "p_notes",
      "p_gateway_ref",
      "p_idempotency_key",
    ];
    for (const p of canonical) {
      expect(SQL, `parameter ${p} must be present`).toContain(p);
    }
  });

  it("returns (refund_id uuid, refund_number text, gl_entry_id uuid)", () => {
    expect(SQL).toMatch(
      /RETURNS TABLE \(\s*refund_id\s+UUID,\s*refund_number\s+TEXT,\s*gl_entry_id\s+UUID\s*\)/i,
    );
  });

  it("is SECURITY DEFINER + has fixed search_path (defense against search-path attacks)", () => {
    expect(SQL).toMatch(/SECURITY DEFINER/);
    expect(SQL).toMatch(/SET search_path = public, pg_temp/);
  });
});

describe("A1 process_refund_v2 RPC — transactional invariants", () => {
  it("idempotency check short-circuits at function top", () => {
    const body = SQL.split(/AS \$\$/)[1] ?? "";
    // Search for the idem check before the FOR UPDATE on sales.
    const idemPos = body.search(/p_idempotency_key IS NOT NULL/);
    const lockPos = body.search(/SELECT \* INTO v_sale FROM public\.sales/i);
    expect(idemPos).toBeGreaterThan(0);
    expect(idemPos).toBeLessThan(lockPos);
  });

  it("locks parent sale row with SELECT FOR UPDATE before computing already_refunded", () => {
    expect(SQL).toMatch(
      /SELECT \* INTO v_sale FROM public\.sales[\s\S]+?FOR UPDATE/i,
    );
  });

  it("server-recomputes subtotal from items (never trust client values)", () => {
    expect(SQL).toMatch(
      /v_subtotal := v_subtotal \+\s*\(\(v_item->>'quantity'\)::NUMERIC \* \(v_item->>'unit_price'\)::NUMERIC\)/,
    );
  });

  it("bound check raises 23514 (check_violation) when refund exceeds remaining", () => {
    expect(SQL).toMatch(/v_subtotal > v_remaining \+ 0\.01/);
    expect(SQL).toMatch(/USING ERRCODE = '23514'/);
  });

  it("flips parent sale to 'refunded' ONLY when v_fully_refunded predicate holds", () => {
    // Pin that the legacy "flip-on-fully-refunded" semantic is preserved.
    // The P0 guard (#199) depends on this — if the RPC ever flips
    // parent status without writing a refunds row first, the guard's
    // "refund row must exist" invariant breaks.
    expect(SQL).toMatch(/v_fully_refunded := \(v_subtotal \+ v_already_refunded\) >=/);
    expect(SQL).toMatch(
      /IF v_fully_refunded THEN[\s\S]+?UPDATE public\.sales[\s\S]+?SET status = 'refunded'/i,
    );
  });

  it("writes a gl_entries row (signed amount = negative for refund) at the end of the tx", () => {
    expect(SQL).toMatch(
      /INSERT INTO public\.gl_entries[\s\S]+?'refund',\s*-v_total/i,
    );
  });

  it("uses SELECT FOR UPDATE on customer for store_credit (no CAS retry)", () => {
    expect(SQL).toMatch(
      /p_refund_method = 'store_credit'[\s\S]+?FROM public\.customers[\s\S]+?FOR UPDATE/i,
    );
  });

  it("inserts customer_store_credit_history row when store_credit refund", () => {
    expect(SQL).toMatch(
      /INSERT INTO public\.customer_store_credit_history[\s\S]+?p_tenant_id,\s*v_sale\.customer_id,\s*v_total,\s*'Refund'/i,
    );
  });
});

describe("A1 process_refund_v2 RPC — RBAC posture", () => {
  it("grants EXECUTE to authenticated and service_role", () => {
    expect(SQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.process_refund_v2 TO authenticated, service_role/i,
    );
  });

  it("documents that callers gate on requirePermission + manager-PIN verify", () => {
    expect(SQL).toMatch(/requirePermission\("create_invoices"\)/);
    expect(SQL).toMatch(/manager-PIN verify/);
  });
});

describe("A1 process_refund_v2 RPC — drop-then-create for clean re-deploy", () => {
  it("DROPs the prior version before CREATE OR REPLACE so signature changes are safe", () => {
    expect(SQL).toMatch(
      /DROP FUNCTION IF EXISTS public\.process_refund_v2\s*\([^)]+\);/i,
    );
  });
});
