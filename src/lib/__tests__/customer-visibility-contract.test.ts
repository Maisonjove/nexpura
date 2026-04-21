import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract tests for the customer-list visibility migration + its
 * consumers. Locks in the policy so a future edit can't accidentally
 * widen a restricted user's view.
 */

const migration = fs.readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/20260421_customer_location_visibility.sql"),
  "utf8",
);
const listPage = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/customers/page.tsx"),
  "utf8",
);
const actions = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/customers/actions.ts"),
  "utf8",
);

describe("get_visible_customer_ids migration (blocker 2)", () => {
  it("defines a function that enforces tenant + deleted_at scoping", () => {
    expect(migration).toMatch(/FUNCTION public\.get_visible_customer_ids/);
    expect(migration).toMatch(/tenant_id = p_tenant_id/);
    expect(migration).toMatch(/deleted_at IS NULL/);
  });

  it("all-access path (v_allowed IS NULL) returns every tenant customer", () => {
    // The function must have a branch that returns every customer when
    // team_members.allowed_location_ids is NULL.
    expect(migration).toMatch(/IF v_allowed IS NULL THEN/);
    expect(migration).toMatch(/RETURN QUERY[\s\S]*?FROM customers[\s\S]*?WHERE tenant_id = p_tenant_id/);
  });

  it("restricted path joins through sales/repairs/bespoke_jobs at allowed locations", () => {
    expect(migration).toMatch(/FROM sales s[\s\S]*?s\.location_id = ANY\(v_allowed\)/);
    expect(migration).toMatch(/FROM repairs r[\s\S]*?r\.location_id = ANY\(v_allowed\)/);
    expect(migration).toMatch(/FROM bespoke_jobs b[\s\S]*?b\.location_id = ANY\(v_allowed\)/);
  });

  it("includes customers with no location-scoped activity at all (new-customer path)", () => {
    // The NOT EXISTS trio — customers with no sales/repairs/bespoke
    // having a non-null location_id — stay visible to all restricted
    // users so new-customer intake works.
    expect(migration).toMatch(/NOT EXISTS[\s\S]*?sales[\s\S]*?location_id IS NOT NULL/);
    expect(migration).toMatch(/NOT EXISTS[\s\S]*?repairs[\s\S]*?location_id IS NOT NULL/);
    expect(migration).toMatch(/NOT EXISTS[\s\S]*?bespoke_jobs[\s\S]*?location_id IS NOT NULL/);
  });

  it("is SECURITY DEFINER and execute-granted only to service_role (least privilege)", () => {
    expect(migration).toMatch(/SECURITY DEFINER/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.get_visible_customer_ids[^;]*anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_visible_customer_ids[^;]*service_role/);
  });
});

describe("customer list surfaces wire the RPC in", () => {
  it("/customers page looks up allowed_location_ids before calling the RPC", () => {
    expect(listPage).toMatch(/allowed_location_ids/);
    expect(listPage).toMatch(/get_visible_customer_ids/);
  });

  it("/customers page applies the visible-id filter to both list and count queries", () => {
    // Both list and count must honour the visibility set — otherwise
    // pagination would leak a misleading total.
    const listPageMatches = listPage.match(/\.in\("id", visibleIds\)/g);
    expect(listPageMatches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("loadMoreCustomers action also applies the filter", () => {
    expect(actions).toMatch(/allowed_location_ids/);
    expect(actions).toMatch(/get_visible_customer_ids/);
    expect(actions).toMatch(/\.in\("id", visibleIds\)/);
  });

  it("empty visible-id list returns empty customers (no fall-through)", () => {
    expect(listPage).toMatch(/visibleIds\.length === 0/);
    expect(actions).toMatch(/visibleIds\.length === 0/);
  });
});
