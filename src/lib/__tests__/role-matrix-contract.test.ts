import { describe, it, expect } from "vitest";
import { DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from "../permissions";
import type { PermissionKey, PermissionMap } from "../permissions";

/**
 * Role matrix regression: the default permission map for each role
 * must enforce the right "who can do what" invariants. Audit finding
 * (High): RBAC was not enforced server-side on critical mutations.
 * With the requirePermission() fix, mutations check `canProcessRefunds`
 * / `edit_bespoke` / etc. against the role's DEFAULT_PERMISSIONS.
 *
 * This test locks the matrix so a future edit that accidentally grants
 * a dangerous permission to a low-privilege role breaks the build.
 */

type Role = keyof typeof DEFAULT_PERMISSIONS;

function can(role: Role, key: PermissionKey): boolean {
  const map = DEFAULT_PERMISSIONS[role] as PermissionMap | undefined;
  return map?.[key] ?? false;
}

describe("role-matrix defaults (regression)", () => {
  it("exports a default map for every non-owner role we rely on", () => {
    const expected: Role[] = [
      "manager",
      "salesperson",
      "workshop_jeweller",
      "repair_technician",
      "inventory_manager",
      "accountant",
      "staff",
    ];
    for (const r of expected) {
      expect(DEFAULT_PERMISSIONS[r]).toBeDefined();
    }
  });

  describe("salesperson — the 'front desk' role", () => {
    it("CAN create invoices (money-moving frontline)", () => {
      expect(can("salesperson", "create_invoices")).toBe(true);
    });
    it("CANNOT manage staff", () => {
      expect(can("salesperson", "manage_staff")).toBe(false);
    });
    it("CANNOT see cost price / margins (prevents accidental customer leak)", () => {
      expect(can("salesperson", "view_cost_price")).toBe(false);
      expect(can("salesperson", "view_margins")).toBe(false);
    });
    it("CANNOT manage billing", () => {
      expect(can("salesperson", "manage_billing")).toBe(false);
    });
  });

  describe("workshop_jeweller — hands-on production role", () => {
    it("CAN edit repairs + bespoke (their actual job)", () => {
      expect(can("workshop_jeweller", "edit_repairs")).toBe(true);
      expect(can("workshop_jeweller", "edit_bespoke")).toBe(true);
    });
    it("CANNOT create invoices", () => {
      expect(can("workshop_jeweller", "create_invoices")).toBe(false);
    });
    it("CANNOT manage staff or billing", () => {
      expect(can("workshop_jeweller", "manage_staff")).toBe(false);
      expect(can("workshop_jeweller", "manage_billing")).toBe(false);
    });
  });

  describe("accountant — money visibility without sales surface", () => {
    it("CAN see cost price + margins + reports", () => {
      expect(can("accountant", "view_cost_price")).toBe(true);
      expect(can("accountant", "view_margins")).toBe(true);
      expect(can("accountant", "access_reports")).toBe(true);
    });
    it("can CREATE invoices (money-entering role)", () => {
      expect(can("accountant", "create_invoices")).toBe(true);
    });
    it("CANNOT manage staff (separation of duties)", () => {
      expect(can("accountant", "manage_staff")).toBe(false);
    });
  });

  describe("staff — lowest-privilege default", () => {
    it("has NO write permissions by default", () => {
      const writeKeys: PermissionKey[] = [
        "edit_inventory",
        "edit_repairs",
        "edit_bespoke",
        "create_invoices",
        "manage_staff",
        "manage_billing",
      ];
      for (const k of writeKeys) {
        expect(can("staff", k)).toBe(false);
      }
    });
  });

  describe("manage_billing gate — owner-only by default", () => {
    it("NO non-owner role has manage_billing via defaults (owner bypasses via isOwner flag)", () => {
      const nonOwnerRoles: Role[] = [
        "manager",
        "salesperson",
        "workshop_jeweller",
        "repair_technician",
        "inventory_manager",
        "accountant",
        "staff",
      ];
      for (const r of nonOwnerRoles) {
        expect(can(r, "manage_billing")).toBe(false);
      }
    });
  });

  describe("manage_staff gate — strict", () => {
    it("ONLY owner/manager can manage staff by default", () => {
      const nonMgmtRoles: Role[] = [
        "salesperson",
        "workshop_jeweller",
        "repair_technician",
        "inventory_manager",
        "accountant",
        "staff",
      ];
      for (const r of nonMgmtRoles) {
        expect(can(r, "manage_staff")).toBe(false);
      }
    });
  });

  it("every role map covers every permission key (no holes)", () => {
    for (const role of Object.keys(DEFAULT_PERMISSIONS) as Role[]) {
      const map = DEFAULT_PERMISSIONS[role];
      for (const k of ALL_PERMISSION_KEYS) {
        expect(map).toHaveProperty(k);
      }
    }
  });
});
