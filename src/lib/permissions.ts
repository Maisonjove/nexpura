import { createAdminClient } from './supabase/admin';
import logger from './logger';

export type PermissionKey =
  | 'view_inventory'
  | 'edit_inventory'
  | 'view_repairs'
  | 'edit_repairs'
  | 'view_bespoke'
  | 'edit_bespoke'
  | 'create_invoices'
  | 'view_cost_price'
  | 'view_margins'
  | 'access_reports'
  | 'access_ai'
  | 'access_website_builder'
  | 'manage_billing'
  | 'manage_staff';

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'view_inventory',
  'edit_inventory',
  'view_repairs',
  'edit_repairs',
  'view_bespoke',
  'edit_bespoke',
  'create_invoices',
  'view_cost_price',
  'view_margins',
  'access_reports',
  'access_ai',
  'access_website_builder',
  'manage_billing',
  'manage_staff',
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_inventory: 'View Inventory',
  edit_inventory: 'Edit Inventory',
  view_repairs: 'View Repairs',
  edit_repairs: 'Edit Repairs',
  view_bespoke: 'View Custom Orders',
  edit_bespoke: 'Edit Custom Orders',
  create_invoices: 'Create Invoices',
  view_cost_price: 'View Cost Price',
  view_margins: 'View Margins',
  access_reports: 'Access Reports',
  access_ai: 'Access AI Copilot',
  access_website_builder: 'Access Website Builder',
  manage_billing: 'Manage Billing',
  manage_staff: 'Manage Staff',
};

export type AppRole =
  | 'owner'
  | 'manager'
  | 'salesperson'
  | 'workshop_jeweller'
  | 'repair_technician'
  | 'inventory_manager'
  | 'accountant'
  | 'staff'
  | 'technician';

export const ALL_ROLES: AppRole[] = [
  'owner',
  'manager',
  'salesperson',
  'workshop_jeweller',
  'repair_technician',
  'inventory_manager',
  'accountant',
];

export type PermissionMap = Record<PermissionKey, boolean>;

// Default permissions per role
export const DEFAULT_PERMISSIONS: Record<string, PermissionMap> = {
  owner: {
    view_inventory: true,
    edit_inventory: true,
    view_repairs: true,
    edit_repairs: true,
    view_bespoke: true,
    edit_bespoke: true,
    create_invoices: true,
    view_cost_price: true,
    view_margins: true,
    access_reports: true,
    access_ai: true,
    access_website_builder: true,
    manage_billing: true,
    manage_staff: true,
  },
  manager: {
    view_inventory: true,
    edit_inventory: true,
    view_repairs: true,
    edit_repairs: true,
    view_bespoke: true,
    edit_bespoke: true,
    create_invoices: true,
    view_cost_price: true,
    view_margins: true,
    access_reports: true,
    access_ai: true,
    access_website_builder: true,
    manage_billing: false,
    manage_staff: true,
  },
  salesperson: {
    view_inventory: true,
    edit_inventory: false,
    view_repairs: true,
    edit_repairs: false,
    view_bespoke: true,
    edit_bespoke: false,
    create_invoices: true,
    view_cost_price: false,
    view_margins: false,
    access_reports: false,
    access_ai: false,
    access_website_builder: false,
    manage_billing: false,
    manage_staff: false,
  },
  workshop_jeweller: {
    view_inventory: true,
    edit_inventory: true,
    view_repairs: true,
    edit_repairs: true,
    view_bespoke: true,
    edit_bespoke: true,
    create_invoices: false,
    view_cost_price: false,
    view_margins: false,
    access_reports: false,
    access_ai: false,
    access_website_builder: false,
    manage_billing: false,
    manage_staff: false,
  },
  repair_technician: {
    view_inventory: true,
    edit_inventory: false,
    view_repairs: true,
    edit_repairs: true,
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
  inventory_manager: {
    view_inventory: true,
    edit_inventory: true,
    view_repairs: true,
    edit_repairs: false,
    view_bespoke: true,
    edit_bespoke: false,
    create_invoices: false,
    view_cost_price: true,
    view_margins: false,
    access_reports: false,
    access_ai: false,
    access_website_builder: false,
    manage_billing: false,
    manage_staff: false,
  },
  accountant: {
    view_inventory: true,
    edit_inventory: false,
    view_repairs: true,
    edit_repairs: false,
    view_bespoke: true,
    edit_bespoke: false,
    create_invoices: true,
    view_cost_price: true,
    view_margins: true,
    access_reports: true,
    access_ai: false,
    access_website_builder: false,
    manage_billing: false,
    manage_staff: false,
  },
  // Legacy roles
  staff: {
    view_inventory: true,
    edit_inventory: false,
    view_repairs: true,
    edit_repairs: false,
    view_bespoke: true,
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
  technician: {
    view_inventory: true,
    edit_inventory: false,
    view_repairs: true,
    edit_repairs: true,
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
};

// Owner always has all permissions - never rely on DB for owner
function isOwnerRole(role: string): boolean {
  return role === 'owner';
}

export async function getPermissionsForRole(
  tenantId: string,
  role: string
): Promise<PermissionMap> {
  // Owner always has all permissions
  if (isOwnerRole(role)) {
    return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as PermissionMap;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('role_permissions')
    .select('permission_key, enabled')
    .eq('tenant_id', tenantId)
    .eq('role', role);

  if (!data || data.length === 0) {
    // Fall back to defaults if no DB entries
    return DEFAULT_PERMISSIONS[role] ?? (Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as PermissionMap);
  }

  const map = Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as PermissionMap;
  for (const row of data) {
    if (row.permission_key in map) {
      (map as Record<string, boolean>)[row.permission_key] = row.enabled;
    }
  }
  return map;
}

export async function getUserPermissions(
  userId: string,
  tenantId: string
): Promise<PermissionMap> {
  // Owner check via users table
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from('users')
    .select('role')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .single();

  const role = userData?.role ?? 'staff';

  if (isOwnerRole(role)) {
    return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as PermissionMap;
  }

  return getPermissionsForRole(tenantId, role);
}

export async function hasPermission(
  userId: string,
  tenantId: string,
  permissionKey: PermissionKey
): Promise<boolean> {
  const perms = await getUserPermissions(userId, tenantId);
  return perms[permissionKey] ?? false;
}

export async function initDefaultPermissions(tenantId: string): Promise<void> {
  const admin = createAdminClient();
  const roles = Object.keys(DEFAULT_PERMISSIONS).filter((r) => r !== 'owner');

  const rows: Array<{
    tenant_id: string;
    role: string;
    permission_key: string;
    enabled: boolean;
  }> = [];

  for (const role of roles) {
    for (const key of ALL_PERMISSION_KEYS) {
      rows.push({
        tenant_id: tenantId,
        role,
        permission_key: key,
        enabled: DEFAULT_PERMISSIONS[role]?.[key as PermissionKey] ?? false,
      });
    }
  }

  // Upsert all at once.
  // Destructive THROW: this runs on tenant onboarding to seed the
  // role_permissions matrix. Without these rows, every staff role-gate
  // check (`hasPermission`) returns false for the tenant — staff can't
  // do anything in the app. State-of-record onboarding write; the
  // caller (provision/setup flow) must surface this and retry.
  const { error } = await admin.from('role_permissions').upsert(rows, {
    onConflict: 'tenant_id,role,permission_key',
    ignoreDuplicates: false,
  });
  if (error) {
    logger.error('[permissions] initDefaultPermissions upsert failed', { tenantId, err: error });
    throw new Error(`permissions: initDefaultPermissions upsert failed for tenant ${tenantId}: ${error.message}`);
  }
}

export async function updateRolePermission(
  tenantId: string,
  role: string,
  permissionKey: PermissionKey,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from('role_permissions').upsert(
    { tenant_id: tenantId, role, permission_key: permissionKey, enabled },
    { onConflict: 'tenant_id,role,permission_key' }
  );
  if (error) return { success: false, error: error.message };
  return { success: true };
}
