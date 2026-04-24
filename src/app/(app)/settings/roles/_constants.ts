/**
 * Plain types + lookup constants for the roles surface.
 *
 * Co-located with the actions but lives in a non-`"use server"` module
 * because Next 16 enforces that a `"use server"` file may only export
 * `async function` declarations — exporting `interface`s and `const`
 * objects from `actions.ts` triggers a runtime crash in the action
 * resolver: `A "use server" file can only export async functions, found
 * object.` (digest 1012104888 in production logs).
 *
 * This file holds the static contract; `actions.ts` keeps only its
 * mutating async functions. `RolesClient.tsx` and the test suites pull
 * the shapes from here.
 */

export interface PermissionSet {
  // View permissions
  canViewDashboard: boolean;
  canViewInventory: boolean;
  canViewCustomers: boolean;
  canViewSales: boolean;
  canViewRepairs: boolean;
  canViewBespoke: boolean;
  canViewReports: boolean;
  canViewFinancials: boolean;
  // Action permissions
  canCreateSales: boolean;
  canEditInventory: boolean;
  canManageCustomers: boolean;
  canProcessRefunds: boolean;
  canManageRepairs: boolean;
  canManageBespoke: boolean;
  canCloseEOD: boolean;
  // Admin permissions
  canManageTeam: boolean;
  canManageSettings: boolean;
  canViewAllLocations: boolean;
}

export interface NotificationPreferences {
  notifyNewRepairs: boolean;
  notifyNewBespoke: boolean;
  notifyRepairReady: boolean;
  notifyBespokeReady: boolean;
  notifyNewSales: boolean;
}

export const DEFAULT_PERMISSIONS: Record<string, PermissionSet> = {
  owner: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: true, canViewSales: true,
    canViewRepairs: true, canViewBespoke: true, canViewReports: true, canViewFinancials: true,
    canCreateSales: true, canEditInventory: true, canManageCustomers: true, canProcessRefunds: true,
    canManageRepairs: true, canManageBespoke: true, canCloseEOD: true,
    canManageTeam: true, canManageSettings: true, canViewAllLocations: true,
  },
  manager: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: true, canViewSales: true,
    canViewRepairs: true, canViewBespoke: true, canViewReports: true, canViewFinancials: true,
    canCreateSales: true, canEditInventory: true, canManageCustomers: true, canProcessRefunds: true,
    canManageRepairs: true, canManageBespoke: true, canCloseEOD: true,
    canManageTeam: true, canManageSettings: false, canViewAllLocations: true,
  },
  salesperson: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: true, canViewSales: true,
    canViewRepairs: false, canViewBespoke: false, canViewReports: false, canViewFinancials: false,
    canCreateSales: true, canEditInventory: false, canManageCustomers: true, canProcessRefunds: false,
    canManageRepairs: false, canManageBespoke: false, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: false,
  },
  workshop_jeweller: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: false, canViewSales: false,
    canViewRepairs: true, canViewBespoke: true, canViewReports: false, canViewFinancials: false,
    canCreateSales: false, canEditInventory: true, canManageCustomers: false, canProcessRefunds: false,
    canManageRepairs: true, canManageBespoke: true, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: false,
  },
  repair_technician: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: false, canViewSales: false,
    canViewRepairs: true, canViewBespoke: false, canViewReports: false, canViewFinancials: false,
    canCreateSales: false, canEditInventory: false, canManageCustomers: false, canProcessRefunds: false,
    canManageRepairs: true, canManageBespoke: false, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: false,
  },
  inventory_manager: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: false, canViewSales: true,
    canViewRepairs: false, canViewBespoke: false, canViewReports: true, canViewFinancials: false,
    canCreateSales: false, canEditInventory: true, canManageCustomers: false, canProcessRefunds: false,
    canManageRepairs: false, canManageBespoke: false, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: true,
  },
  accountant: {
    canViewDashboard: true, canViewInventory: false, canViewCustomers: false, canViewSales: true,
    canViewRepairs: false, canViewBespoke: false, canViewReports: true, canViewFinancials: true,
    canCreateSales: false, canEditInventory: false, canManageCustomers: false, canProcessRefunds: true,
    canManageRepairs: false, canManageBespoke: false, canCloseEOD: true,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: true,
  },
  staff: {
    canViewDashboard: true, canViewInventory: true, canViewCustomers: true, canViewSales: true,
    canViewRepairs: false, canViewBespoke: false, canViewReports: false, canViewFinancials: false,
    canCreateSales: true, canEditInventory: false, canManageCustomers: false, canProcessRefunds: false,
    canManageRepairs: false, canManageBespoke: false, canCloseEOD: false,
    canManageTeam: false, canManageSettings: false, canViewAllLocations: false,
  },
};
