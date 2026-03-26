import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PermissionsMatrixClient from "./PermissionsMatrixClient";
import {
  ALL_PERMISSION_KEYS,
  ALL_ROLES,
  PERMISSION_LABELS,
  DEFAULT_PERMISSIONS,
  type PermissionMap,
} from "@/lib/permissions";

export const metadata = { title: "Permission Matrix — Nexpura" };

export default async function PermissionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (userData?.role !== "owner") {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">Only owners can manage permission settings.</p>
      </div>
    );
  }

  const tenantId = userData.tenant_id!;
  const admin = createAdminClient();

  // Fetch existing permissions
  const { data: dbPerms } = await admin
    .from("role_permissions")
    .select("role, permission_key, enabled")
    .eq("tenant_id", tenantId);

  // Build permission map: role → permissionKey → enabled
  const nonOwnerRoles = ALL_ROLES.filter((r) => r !== "owner");
  const permissionMatrix: Record<string, PermissionMap> = {};

  for (const role of nonOwnerRoles) {
    const defaults = DEFAULT_PERMISSIONS[role] ?? {};
    const map = Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, defaults[k] ?? false])) as PermissionMap;
    permissionMatrix[role] = map;
  }

  // Override with DB values
  for (const row of dbPerms ?? []) {
    if (row.role in permissionMatrix && row.permission_key in permissionMatrix[row.role]) {
      (permissionMatrix[row.role] as Record<string, boolean>)[row.permission_key] = row.enabled;
    }
  }

  return (
    <PermissionsMatrixClient
      tenantId={tenantId}
      roles={nonOwnerRoles}
      permissionKeys={ALL_PERMISSION_KEYS}
      permissionLabels={PERMISSION_LABELS}
      permissionMatrix={permissionMatrix}
    />
  );
}
