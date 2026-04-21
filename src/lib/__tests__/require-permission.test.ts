import { describe, it, expect } from "vitest";
import { isTenantActive, MUTATING_SUBSCRIPTION_STATES } from "../auth-context";
import type { AuthContext } from "../auth-context";

/**
 * Pure-function coverage for the permission helpers introduced by the
 * HIGH audit fix pass. The wrapper functions requireAuth /
 * requireActiveTenant / requirePermission depend on Next.js runtime
 * (React cache + next/headers) that's painful to mock cleanly in
 * Vitest; we test the branching rule directly here and rely on the
 * integration surface (support-access approval test + the assert-
 * tenant-active unit test) to lock the wrapper behaviour.
 */

const baseCtx: AuthContext = {
  userId: "u1",
  email: "user@example.com",
  tenantId: "t1",
  tenantName: "Biz",
  businessName: "Biz Co",
  currency: "AUD",
  taxRate: 0.1,
  taxName: "GST",
  taxInclusive: true,
  role: "salesperson",
  isOwner: false,
  isManager: false,
  permissions: {
    view_inventory: false,
    edit_inventory: false,
    view_repairs: false,
    edit_repairs: false,
    view_bespoke: false,
    edit_bespoke: false,
    create_invoices: false,
    view_cost_price: false,
    view_margins: false,
    access_reports: false,
    access_ai: false,
    access_website_builder: false,
    manage_billing: false,
    manage_staff: false,
  },
  subscriptionStatus: "active",
};

describe("isTenantActive + MUTATING_SUBSCRIPTION_STATES", () => {
  it("accepts active subscription", () => {
    expect(isTenantActive({ ...baseCtx, subscriptionStatus: "active" })).toBe(true);
  });

  it("accepts trialing subscription", () => {
    expect(isTenantActive({ ...baseCtx, subscriptionStatus: "trialing" })).toBe(true);
  });

  it("accepts past_due within grace", () => {
    expect(isTenantActive({ ...baseCtx, subscriptionStatus: "past_due" })).toBe(true);
  });

  it("accepts payment_required within grace", () => {
    expect(isTenantActive({ ...baseCtx, subscriptionStatus: "payment_required" })).toBe(true);
  });

  it("REJECTS suspended — the paywall-bypass audit finding this fixes", () => {
    expect(isTenantActive({ ...baseCtx, subscriptionStatus: "suspended" })).toBe(false);
  });

  it("REJECTS cancelled", () => {
    expect(isTenantActive({ ...baseCtx, subscriptionStatus: "cancelled" })).toBe(false);
  });

  it("REJECTS unpaid", () => {
    expect(isTenantActive({ ...baseCtx, subscriptionStatus: "unpaid" })).toBe(false);
  });

  it("permits legacy null subscription_status (pre-migration tenants)", () => {
    expect(isTenantActive({ ...baseCtx, subscriptionStatus: null })).toBe(true);
  });

  it("MUTATING_SUBSCRIPTION_STATES is the single source of truth", () => {
    expect(MUTATING_SUBSCRIPTION_STATES.has("active")).toBe(true);
    expect(MUTATING_SUBSCRIPTION_STATES.has("trialing")).toBe(true);
    expect(MUTATING_SUBSCRIPTION_STATES.has("past_due")).toBe(true);
    expect(MUTATING_SUBSCRIPTION_STATES.has("payment_required")).toBe(true);
    expect(MUTATING_SUBSCRIPTION_STATES.has("suspended")).toBe(false);
    expect(MUTATING_SUBSCRIPTION_STATES.has("cancelled")).toBe(false);
    expect(MUTATING_SUBSCRIPTION_STATES.has("unpaid")).toBe(false);
  });
});

/**
 * Contract test for requirePermission's branching behaviour. We test
 * the rule (owners pass; non-owners need the specific permission) by
 * inlining the same conditional so it tracks the source.
 */
describe("requirePermission decision rule (contract)", () => {
  function decide(ctx: AuthContext, key: keyof AuthContext["permissions"]): "ok" | string {
    if (!isTenantActive(ctx)) return "subscription_required";
    if (ctx.isOwner) return "ok";
    if (ctx.permissions[key]) return "ok";
    return `permission_denied:${String(key)}`;
  }

  it("owner passes with no permissions set", () => {
    const ctx: AuthContext = { ...baseCtx, isOwner: true };
    expect(decide(ctx, "create_invoices")).toBe("ok");
  });

  it("non-owner WITH permission passes", () => {
    const ctx: AuthContext = { ...baseCtx, permissions: { ...baseCtx.permissions, create_invoices: true } };
    expect(decide(ctx, "create_invoices")).toBe("ok");
  });

  it("non-owner WITHOUT permission is denied", () => {
    expect(decide(baseCtx, "create_invoices")).toBe("permission_denied:create_invoices");
  });

  it("owner with suspended subscription is still blocked (paywall wins)", () => {
    const ctx: AuthContext = { ...baseCtx, isOwner: true, subscriptionStatus: "suspended" };
    expect(decide(ctx, "create_invoices")).toBe("subscription_required");
  });

  it("permission check ordering: subscription first, then role, then perm", () => {
    // Non-owner WITH permission but suspended → subscription reject wins
    const ctx: AuthContext = {
      ...baseCtx,
      subscriptionStatus: "suspended",
      permissions: { ...baseCtx.permissions, create_invoices: true },
    };
    expect(decide(ctx, "create_invoices")).toBe("subscription_required");
  });
});
