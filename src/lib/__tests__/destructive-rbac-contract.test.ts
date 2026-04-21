import { describe, it, expect } from "vitest";
import { DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from "../permissions";
import type { PermissionKey, PermissionMap } from "../permissions";
import type { AuthContext } from "../auth-context";
import { isTenantActive } from "../auth-context";

/**
 * Regression contract: every destructive server action we gated in the
 * RBAC hardening pass must reject low-privilege roles server-side.
 *
 * We don't mock Next's runtime (the existing pattern: see
 * require-permission.test.ts). Instead we test the decision rule by
 * inlining the same conditional the production gate uses. A future
 * change that accidentally grants a low-privilege role one of these
 * dangerous permissions will break this test and the build.
 *
 * Covered gates:
 * - archiveCustomer (owner/manager only)
 * - voidInvoice (create_invoices)
 * - voidVoucher (create_invoices)
 * - deleteExpense (create_invoices)
 * - deleteSale (create_invoices)
 * - deleteSupplier (owner/manager only)
 * - deleteQuote (create_invoices)
 * - archiveRepair (owner/manager only)
 * - archiveBespokeJob (owner/manager only)
 */

type Role = keyof typeof DEFAULT_PERMISSIONS;

function makeCtx(role: Role): AuthContext {
  const isOwner = role === "owner";
  const isManager = role === "owner" || role === "manager";
  const perms = isOwner
    ? (Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as PermissionMap)
    : (DEFAULT_PERMISSIONS[role] as PermissionMap) ??
      (Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as PermissionMap);
  return {
    userId: "u1",
    email: "u@example.com",
    tenantId: "t1",
    tenantName: "Biz",
    businessName: "Biz Co",
    currency: "AUD",
    taxRate: 0.1,
    taxName: "GST",
    taxInclusive: true,
    role,
    isOwner,
    isManager,
    permissions: perms,
    subscriptionStatus: "active",
  };
}

/** Matches the production requirePermission() branching. */
function decidePermission(ctx: AuthContext, key: PermissionKey): "ok" | string {
  if (!isTenantActive(ctx)) return "subscription_required";
  if (ctx.isOwner) return "ok";
  if (ctx.permissions[key]) return "ok";
  return `permission_denied:${key}`;
}

/** Matches the production isManager/isOwner soft-delete gate. */
function decideManagerGate(ctx: AuthContext): "ok" | "denied" {
  if (!isTenantActive(ctx)) return "denied";
  if (ctx.isManager || ctx.isOwner) return "ok";
  return "denied";
}

const LOW_PRIV_ROLES: Role[] = [
  "salesperson",
  "workshop_jeweller",
  "repair_technician",
  "inventory_manager",
  "accountant",
  "staff",
];

describe("destructive RBAC gates — create_invoices bucket", () => {
  // voidInvoice, voidVoucher, deleteExpense, deleteSale, deleteQuote,
  // refund processing — all gated on create_invoices.
  const gatedActions = [
    "voidInvoice",
    "voidVoucher",
    "deleteExpense",
    "deleteSale",
    "deleteQuote",
  ];

  for (const action of gatedActions) {
    describe(action, () => {
      it("owner passes", () => {
        expect(decidePermission(makeCtx("owner"), "create_invoices")).toBe("ok");
      });
      it("manager passes (default create_invoices=true)", () => {
        expect(decidePermission(makeCtx("manager"), "create_invoices")).toBe("ok");
      });
      it("salesperson passes (frontline money-moving role)", () => {
        expect(decidePermission(makeCtx("salesperson"), "create_invoices")).toBe("ok");
      });
      it("accountant passes (money-entering role)", () => {
        expect(decidePermission(makeCtx("accountant"), "create_invoices")).toBe("ok");
      });
      it("workshop_jeweller is denied", () => {
        expect(decidePermission(makeCtx("workshop_jeweller"), "create_invoices")).toBe(
          "permission_denied:create_invoices"
        );
      });
      it("repair_technician is denied", () => {
        expect(decidePermission(makeCtx("repair_technician"), "create_invoices")).toBe(
          "permission_denied:create_invoices"
        );
      });
      it("inventory_manager is denied", () => {
        expect(decidePermission(makeCtx("inventory_manager"), "create_invoices")).toBe(
          "permission_denied:create_invoices"
        );
      });
      it("staff is denied", () => {
        expect(decidePermission(makeCtx("staff"), "create_invoices")).toBe(
          "permission_denied:create_invoices"
        );
      });
      it("suspended-tenant owner is still blocked by paywall", () => {
        const ctx = { ...makeCtx("owner"), subscriptionStatus: "suspended" };
        expect(decidePermission(ctx, "create_invoices")).toBe("subscription_required");
      });
    });
  }
});

describe("destructive RBAC gates — owner/manager bucket", () => {
  // archiveCustomer, deleteSupplier, archiveRepair, archiveBespokeJob —
  // soft-delete / cascade-destructive actions reserved for management.
  const gatedActions = [
    "archiveCustomer",
    "deleteSupplier",
    "archiveRepair",
    "archiveBespokeJob",
  ];

  for (const action of gatedActions) {
    describe(action, () => {
      it("owner passes", () => {
        expect(decideManagerGate(makeCtx("owner"))).toBe("ok");
      });
      it("manager passes", () => {
        expect(decideManagerGate(makeCtx("manager"))).toBe("ok");
      });
      for (const role of LOW_PRIV_ROLES) {
        it(`${role} is denied`, () => {
          expect(decideManagerGate(makeCtx(role))).toBe("denied");
        });
      }
    });
  }
});

describe("RBAC contract sanity", () => {
  it("no low-privilege role has create_invoices=true except salesperson + accountant", () => {
    const expectedYes: Role[] = ["salesperson", "accountant"];
    const allRoles: Role[] = [
      "manager",
      "salesperson",
      "workshop_jeweller",
      "repair_technician",
      "inventory_manager",
      "accountant",
      "staff",
    ];
    for (const r of allRoles) {
      const ctx = makeCtx(r);
      const has = ctx.permissions.create_invoices;
      if (r === "manager" || expectedYes.includes(r)) {
        expect(has).toBe(true);
      } else {
        expect(has).toBe(false);
      }
    }
  });

  it("isManager flag is true ONLY for owner and manager roles", () => {
    expect(makeCtx("owner").isManager).toBe(true);
    expect(makeCtx("manager").isManager).toBe(true);
    for (const r of LOW_PRIV_ROLES) {
      expect(makeCtx(r).isManager).toBe(false);
    }
  });
});
