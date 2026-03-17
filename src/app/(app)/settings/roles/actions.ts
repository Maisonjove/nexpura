"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { userId: user.id, tenantId: userData.tenant_id };
}

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

export async function updateMemberPermissions(
  memberId: string,
  permissions: Partial<PermissionSet>
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { error } = await admin
    .from("team_members")
    .update({ permissions })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMemberRole(
  memberId: string,
  role: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  // Update role and set default permissions for that role
  const defaultPerms = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.staff;
  
  const { error } = await admin
    .from("team_members")
    .update({ role, permissions: defaultPerms })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMemberLocationAccess(
  memberId: string,
  allowedLocationIds: string[] | null // null = all locations
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { error } = await admin
    .from("team_members")
    .update({ allowed_location_ids: allowedLocationIds })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMemberDefaultLocation(
  memberId: string,
  defaultLocationId: string | null
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { error } = await admin
    .from("team_members")
    .update({ default_location_id: defaultLocationId })
    .eq("id", memberId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  return { success: true };
}
