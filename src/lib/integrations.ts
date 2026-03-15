/**
 * Shared integration helpers — server-side only.
 * Use createAdminClient() to bypass RLS for tenant-scoped lookups.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type IntegrationType = "xero" | "whatsapp" | "shopify" | "insurance";

export interface Integration {
  id: string;
  tenant_id: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  status: "connected" | "disconnected" | "error";
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get an integration record for a tenant by type.
 * Returns null if not found.
 */
export async function getIntegration(
  tenantId: string,
  type: IntegrationType
): Promise<Integration | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("type", type)
    .single();
  return data ?? null;
}

/**
 * Upsert an integration record for a tenant.
 */
export async function upsertIntegration(
  tenantId: string,
  type: IntegrationType,
  config: Record<string, unknown>,
  status: "connected" | "disconnected" | "error" = "connected"
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("integrations").upsert(
    {
      tenant_id: tenantId,
      type,
      config,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,type" }
  );
  return error ? { error: error.message } : {};
}

/**
 * Get all integrations for a tenant (status overview).
 */
export async function getAllIntegrations(
  tenantId: string
): Promise<Integration[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("*")
    .eq("tenant_id", tenantId);
  return data ?? [];
}

/**
 * Get tenant auth context from a server request.
 * Returns userId and tenantId or throws.
 */
export async function getAuthContext() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return {
    userId: user.id,
    tenantId: userData.tenant_id as string,
    role: userData.role as string,
  };
}
