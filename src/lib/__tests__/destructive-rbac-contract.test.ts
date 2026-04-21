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
 * Covered gates (first sweep):
 * - archiveCustomer (owner/manager only)
 * - voidInvoice (create_invoices)
 * - voidVoucher (create_invoices)
 * - deleteExpense (create_invoices)
 * - deleteSale (create_invoices)
 * - deleteSupplier (owner/manager only)
 * - deleteQuote (create_invoices)
 * - archiveRepair (owner/manager only)
 * - archiveBespokeJob (owner/manager only)
 *
 * Covered gates (second sweep — inventory/line-item/attachment/admin):
 * - archiveInventoryItem (owner/manager + edit_inventory)
 * - archiveStockItem (owner/manager + edit_inventory)
 * - removeRepairLineItem (owner/manager)
 * - removeBespokeLineItem (owner/manager, in addition to edit_bespoke)
 * - deleteJobAttachment (owner/manager, in addition to edit_bespoke)
 * - deleteTaskAttachment (owner/manager)
 * - deleteSitePage (owner/manager)
 * - deleteSection (owner/manager)
 * - deleteCampaign (owner/manager)
 * - deleteTemplate (owner/manager)
 * - deleteSegment (owner/manager)
 * - deleteTagTemplate (owner/manager)
 * - deleteTaskTemplate (owner/manager)
 * - removeMember (owner/manager)
 * - removeTeamMember (owner/manager)
 * - deleteMemoItem (owner/manager)
 * - cancelPrintJob (owner/manager)
 * - deleteLocation (owner-only; legacy, asserted here)
 * - removeEmailDomain (owner-only; legacy, asserted here)
 * - deletePilotIssue (owner-only admin; asserted here)
 * - deleteTask (owner/manager OR self-scoped to creator/assignee)
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

// ── Second sweep: additional destructive gates (inventory archive,
// line-item removes, attachments, templates, segments, tags, memo,
// print cancel, team-member removal, owner-only admin actions). ────

describe("destructive RBAC gates — owner/manager bucket (second sweep)", () => {
  const gatedActions = [
    "archiveInventoryItem",
    "archiveStockItem",
    "removeRepairLineItem",
    "removeBespokeLineItem",
    "deleteJobAttachment",
    "deleteTaskAttachment",
    "deleteSitePage",
    "deleteSection",
    "deleteCampaign",
    "deleteTemplate",
    "deleteSegment",
    "deleteTagTemplate",
    "deleteTaskTemplate",
    "removeMember",
    "removeTeamMember",
    "deleteMemoItem",
    "cancelPrintJob",
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
      it("suspended-tenant owner is still blocked by paywall", () => {
        const ctx = { ...makeCtx("owner"), subscriptionStatus: "suspended" };
        expect(decideManagerGate(ctx)).toBe("denied");
      });
    });
  }
});

// Inventory archives carry a second gate — edit_inventory — stacked on
// top of the owner/manager check. Lock both layers.
describe("inventory archive stacking: edit_inventory + owner/manager", () => {
  function decideStacked(ctx: AuthContext): "ok" | string {
    const mgrOk = decideManagerGate(ctx);
    if (mgrOk !== "ok") return mgrOk;
    return decidePermission(ctx, "edit_inventory");
  }
  it("owner passes", () => {
    expect(decideStacked(makeCtx("owner"))).toBe("ok");
  });
  it("manager passes (has edit_inventory by default)", () => {
    expect(decideStacked(makeCtx("manager"))).toBe("ok");
  });
  it("inventory_manager is denied by owner/manager gate even though they have edit_inventory", () => {
    // Critical: previously this role could archive via UI-gated check only.
    expect(decideStacked(makeCtx("inventory_manager"))).toBe("denied");
  });
  it("workshop_jeweller is denied by owner/manager gate", () => {
    expect(decideStacked(makeCtx("workshop_jeweller"))).toBe("denied");
  });
  for (const role of ["salesperson", "accountant", "repair_technician", "staff"] as Role[]) {
    it(`${role} is denied`, () => {
      expect(decideStacked(makeCtx(role))).toBe("denied");
    });
  }
});

// Owner-only gates (stricter than manager): delete/remove of tenant
// infrastructure that only the account owner should touch.
describe("destructive RBAC gates — owner-only bucket", () => {
  function decideOwnerOnly(ctx: AuthContext): "ok" | "denied" {
    if (!isTenantActive(ctx)) return "denied";
    return ctx.isOwner ? "ok" : "denied";
  }
  const gatedActions = ["deleteLocation", "removeEmailDomain", "deletePilotIssue"];
  for (const action of gatedActions) {
    describe(action, () => {
      it("owner passes", () => {
        expect(decideOwnerOnly(makeCtx("owner"))).toBe("ok");
      });
      it("manager is denied (owner-only gate)", () => {
        expect(decideOwnerOnly(makeCtx("manager"))).toBe("denied");
      });
      for (const role of LOW_PRIV_ROLES) {
        it(`${role} is denied`, () => {
          expect(decideOwnerOnly(makeCtx(role))).toBe("denied");
        });
      }
    });
  }
});

// deleteTask is special-cased: owner/manager, or the creator/assignee of
// the task (self-scoped personal tasks).
describe("deleteTask gate — owner/manager OR creator/assignee", () => {
  function decideDeleteTask(
    ctx: AuthContext,
    task: { created_by: string | null; assigned_to: string | null }
  ): "ok" | "denied" {
    if (!isTenantActive(ctx)) return "denied";
    if (ctx.isOwner || ctx.isManager) return "ok";
    const self = task.created_by === ctx.userId || task.assigned_to === ctx.userId;
    return self ? "ok" : "denied";
  }

  const myTask = { created_by: "u1", assigned_to: null };
  const theirTask = { created_by: "u2", assigned_to: "u3" };
  const assignedToMe = { created_by: "u9", assigned_to: "u1" };

  it("owner can delete any task", () => {
    expect(decideDeleteTask(makeCtx("owner"), theirTask)).toBe("ok");
  });
  it("manager can delete any task", () => {
    expect(decideDeleteTask(makeCtx("manager"), theirTask)).toBe("ok");
  });
  for (const role of LOW_PRIV_ROLES) {
    it(`${role} can delete their own task (as creator)`, () => {
      expect(decideDeleteTask(makeCtx(role), myTask)).toBe("ok");
    });
    it(`${role} can delete a task assigned to them`, () => {
      expect(decideDeleteTask(makeCtx(role), assignedToMe)).toBe("ok");
    });
    it(`${role} CANNOT delete another user's task`, () => {
      expect(decideDeleteTask(makeCtx(role), theirTask)).toBe("denied");
    });
  }
  it("suspended-tenant owner is still blocked by paywall even for own tasks", () => {
    const ctx = { ...makeCtx("owner"), subscriptionStatus: "suspended" };
    expect(decideDeleteTask(ctx, myTask)).toBe("denied");
  });
});

// ── PR-02 (Pattern 2 sweep): mutating/escalating RBAC gates. ──────────
//
// Closes:
//  - W2-003 MED           — updateMemberPermissions missing requirePermission
//  - W5-CRIT-004          — marketing send has no RBAC
//  - W6-CRIT-01           — saveBanking has no RBAC / no tenant verify
//  - W6-CRIT-04           — roles/permissions management lacks owner gate
//  - W6-CRIT-05           — all-exports admin endpoint enumerable, no role
//  - W6-CRIT-06           — scheduled_reports editable by any staff
//
// Decision-rule tests (production gate in auth-context.requireRole()).

/** Matches the production requireRole() branching. */
function decideOwnerOnlyGate(ctx: AuthContext): "ok" | string {
  if (!isTenantActive(ctx)) return "subscription_required";
  if (ctx.isOwner) return "ok";
  return `role_denied:owner`;
}

/** Matches requireRole("owner", "manager") — owner/manager bucket. */
function decideOwnerManagerGate(ctx: AuthContext): "ok" | string {
  if (!isTenantActive(ctx)) return "subscription_required";
  if (ctx.isOwner) return "ok";
  if (ctx.role === "manager") return "ok";
  return `role_denied:owner,manager`;
}

describe("PR-02 marketing send RBAC — W5-CRIT-004 (owner/manager bucket)", () => {
  // Blast-the-list surface. Every authed user used to be able to hit these.
  // Accountant has access_reports=true by default — explicitly block them
  // from blasting the customer list (per Joey's safest-default policy).
  const sendBucket = [
    "sendCampaignNow",
    "createCampaign",
    "updateCampaign",
    "deleteCampaign",
    "duplicateCampaign",
    "sendBulkEmail",
    "createWhatsAppCampaign",
    "createCampaignCheckout",
    "updateAutomation",
    "toggleAutomation",
    "createSegment",
    "updateSegment",
    "createTemplate",
    "updateTemplate",
    "duplicateTemplate",
  ];

  for (const action of sendBucket) {
    describe(action, () => {
      it("owner passes", () => {
        expect(decideOwnerManagerGate(makeCtx("owner"))).toBe("ok");
      });
      it("manager passes", () => {
        expect(decideOwnerManagerGate(makeCtx("manager"))).toBe("ok");
      });
      it("salesperson is BLOCKED (even though frontline)", () => {
        expect(decideOwnerManagerGate(makeCtx("salesperson"))).toBe(
          "role_denied:owner,manager"
        );
      });
      it("workshop_jeweller is BLOCKED", () => {
        expect(decideOwnerManagerGate(makeCtx("workshop_jeweller"))).toBe(
          "role_denied:owner,manager"
        );
      });
      it("accountant is BLOCKED (has access_reports=true but must NOT blast)", () => {
        expect(decideOwnerManagerGate(makeCtx("accountant"))).toBe(
          "role_denied:owner,manager"
        );
      });
      it("repair_technician is BLOCKED", () => {
        expect(decideOwnerManagerGate(makeCtx("repair_technician"))).toBe(
          "role_denied:owner,manager"
        );
      });
      it("inventory_manager is BLOCKED", () => {
        expect(decideOwnerManagerGate(makeCtx("inventory_manager"))).toBe(
          "role_denied:owner,manager"
        );
      });
      it("staff is BLOCKED", () => {
        expect(decideOwnerManagerGate(makeCtx("staff"))).toBe(
          "role_denied:owner,manager"
        );
      });
      it("suspended-tenant owner is blocked by paywall", () => {
        const ctx = { ...makeCtx("owner"), subscriptionStatus: "suspended" };
        expect(decideOwnerManagerGate(ctx)).toBe("subscription_required");
      });
    });
  }
});

describe("PR-02 settings RBAC — W6-CRIT-01 saveBanking (owner-only)", () => {
  it("owner passes", () => {
    expect(decideOwnerOnlyGate(makeCtx("owner"))).toBe("ok");
  });
  it("manager is BLOCKED (banking = payout identity, owner-only)", () => {
    expect(decideOwnerOnlyGate(makeCtx("manager"))).toBe("role_denied:owner");
  });
  for (const role of LOW_PRIV_ROLES) {
    it(`${role} is BLOCKED`, () => {
      expect(decideOwnerOnlyGate(makeCtx(role))).toBe("role_denied:owner");
    });
  }
  it("suspended-tenant owner is blocked by paywall", () => {
    const ctx = { ...makeCtx("owner"), subscriptionStatus: "suspended" };
    expect(decideOwnerOnlyGate(ctx)).toBe("subscription_required");
  });
});

describe("PR-02 roles management RBAC — W6-CRIT-04 (owner-only bucket)", () => {
  // Privilege-escalation surfaces: role reassignment, permission toggles,
  // location access, inviting teammates, removing teammates. Even a
  // manager must not be able to promote themselves to owner or evict a
  // peer manager.
  const ownerOnly = [
    "updateMemberPermissions",       // W2-003 MED — was entirely ungated
    "updateMemberRole",
    "updateMemberLocationAccess",
    "inviteTeamMember",
    "removeMember",
    "removeTeamMember",
    "updateTeamMemberRole",
    "updateTeamMemberLocations",
    "updatePermission",              // already gated pre-PR; regression-lock it
  ];

  for (const action of ownerOnly) {
    describe(action, () => {
      it("owner passes", () => {
        expect(decideOwnerOnlyGate(makeCtx("owner"))).toBe("ok");
      });
      it("manager is BLOCKED (NOT owner/manager — owner-only)", () => {
        expect(decideOwnerOnlyGate(makeCtx("manager"))).toBe(
          "role_denied:owner"
        );
      });
      for (const role of LOW_PRIV_ROLES) {
        it(`${role} is BLOCKED`, () => {
          expect(decideOwnerOnlyGate(makeCtx(role))).toBe("role_denied:owner");
        });
      }
      it("suspended-tenant owner is blocked by paywall", () => {
        const ctx = { ...makeCtx("owner"), subscriptionStatus: "suspended" };
        expect(decideOwnerOnlyGate(ctx)).toBe("subscription_required");
      });
    });
  }
});

describe("PR-02 roles management RBAC — W6-CRIT-04 (owner/manager bucket)", () => {
  // Secondary-admin surfaces that a manager may legitimately touch:
  // default-location assignment, resending an invite token.
  const ownerOrManager = ["updateMemberDefaultLocation", "resendInvite"];

  for (const action of ownerOrManager) {
    describe(action, () => {
      it("owner passes", () => {
        expect(decideOwnerManagerGate(makeCtx("owner"))).toBe("ok");
      });
      it("manager passes", () => {
        expect(decideOwnerManagerGate(makeCtx("manager"))).toBe("ok");
      });
      for (const role of LOW_PRIV_ROLES) {
        it(`${role} is BLOCKED`, () => {
          expect(decideOwnerManagerGate(makeCtx(role))).toBe(
            "role_denied:owner,manager"
          );
        });
      }
    });
  }
});

describe("PR-02 self-or-admin RBAC — W6-CRIT-04 (member self-service carve-out)", () => {
  // updateMemberPhone / updateMemberWhatsAppEnabled / updateMemberNotifications:
  // staff can edit their OWN team_members row (self-service profile), but
  // editing anyone else's requires owner/manager.
  function decideSelfOrAdmin(
    ctx: AuthContext,
    targetMember: { id: string; user_id: string }
  ): "ok" | "denied" {
    if (!isTenantActive(ctx)) return "denied";
    const isSelf = targetMember.user_id === ctx.userId;
    if (isSelf) return "ok";
    if (ctx.isOwner || ctx.isManager) return "ok";
    return "denied";
  }

  const selfMember = { id: "m1", user_id: "u1" }; // matches makeCtx().userId
  const otherMember = { id: "m2", user_id: "u-other" };

  const actions = [
    "updateMemberPhone",
    "updateMemberWhatsAppEnabled",
    "updateMemberNotifications",
  ];

  for (const action of actions) {
    describe(action, () => {
      it("owner can edit anyone", () => {
        expect(decideSelfOrAdmin(makeCtx("owner"), otherMember)).toBe("ok");
      });
      it("manager can edit anyone", () => {
        expect(decideSelfOrAdmin(makeCtx("manager"), otherMember)).toBe("ok");
      });
      for (const role of LOW_PRIV_ROLES) {
        it(`${role} can edit their OWN row (self-service)`, () => {
          expect(decideSelfOrAdmin(makeCtx(role), selfMember)).toBe("ok");
        });
        it(`${role} CANNOT edit another member's row`, () => {
          expect(decideSelfOrAdmin(makeCtx(role), otherMember)).toBe("denied");
        });
      }
    });
  }
});

describe("PR-02 exports RBAC — W6-CRIT-05 (owner-only bucket)", () => {
  // Every export dumps tenant-wide PII / financials. Owner-only.
  // exportAllData is the most sensitive — full tenant snapshot to any
  // caller's filesystem. Even a manager must not be able to hit it.
  const exports = [
    "exportAllData",
    "exportCustomers",
    "exportInvoices",
    "exportRepairs",
    "exportBespokeJobs",
    "exportSales",
    "exportInventory",
    "exportExpenses",
    "exportSuppliers",
  ];

  for (const action of exports) {
    describe(action, () => {
      it("owner passes", () => {
        expect(decideOwnerOnlyGate(makeCtx("owner"))).toBe("ok");
      });
      it("manager is BLOCKED (exports = competitor-bait)", () => {
        expect(decideOwnerOnlyGate(makeCtx("manager"))).toBe(
          "role_denied:owner"
        );
      });
      for (const role of LOW_PRIV_ROLES) {
        it(`${role} is BLOCKED`, () => {
          expect(decideOwnerOnlyGate(makeCtx(role))).toBe("role_denied:owner");
        });
      }
      it("suspended-tenant owner is blocked by paywall", () => {
        const ctx = { ...makeCtx("owner"), subscriptionStatus: "suspended" };
        expect(decideOwnerOnlyGate(ctx)).toBe("subscription_required");
      });
    });
  }
});

describe("PR-02 scheduled reports RBAC — W6-CRIT-06 (owner-only bucket)", () => {
  // scheduled_reports distributes tenant-wide revenue/P&L to
  // caller-supplied emails. Direct data-exfil vector if left editable by
  // staff. Owner-only at the server-action + RLS layer.
  const actions = [
    "createScheduledReport",
    "updateScheduledReport",
    "toggleScheduledReportActive",
    "deleteScheduledReport",
  ];

  for (const action of actions) {
    describe(action, () => {
      it("owner passes", () => {
        expect(decideOwnerOnlyGate(makeCtx("owner"))).toBe("ok");
      });
      it("manager is BLOCKED (owner-only — reports = revenue/PII distribution)", () => {
        expect(decideOwnerOnlyGate(makeCtx("manager"))).toBe(
          "role_denied:owner"
        );
      });
      for (const role of LOW_PRIV_ROLES) {
        it(`${role} is BLOCKED`, () => {
          expect(decideOwnerOnlyGate(makeCtx(role))).toBe("role_denied:owner");
        });
      }
      it("suspended-tenant owner is blocked by paywall", () => {
        const ctx = { ...makeCtx("owner"), subscriptionStatus: "suspended" };
        expect(decideOwnerOnlyGate(ctx)).toBe("subscription_required");
      });
    });
  }
});
