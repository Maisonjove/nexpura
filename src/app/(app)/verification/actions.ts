"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

interface CredentialPayload {
  employee_name: string;
  user_id?: string | null;
  credential_type: string;
  issuer?: string;
  issued_date?: string;
  expiry_date?: string;
  document_url?: string;
  notes?: string;
}

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { admin, userId: user.id, tenantId: userData.tenant_id as string, role: (userData as { role?: string }).role ?? "staff" };
}

export async function createCredential(payload: CredentialPayload): Promise<{ id?: string; error?: string }> {
  let c;
  try { c = await ctx(); } catch (e) { return { error: e instanceof Error ? e.message : "Auth failed" }; }
  if (!["owner", "admin", "manager"].includes(c.role)) {
    return { error: "Only owner or manager can create credentials." };
  }
  if (!payload.employee_name?.trim() || !payload.credential_type?.trim()) {
    return { error: "Employee name and credential type are required." };
  }

  const { data, error } = await c.admin
    .from("employee_credentials")
    .insert({
      tenant_id: c.tenantId,
      user_id: payload.user_id ?? null,
      employee_name: payload.employee_name.trim(),
      credential_type: payload.credential_type.trim(),
      issuer: payload.issuer?.trim() || null,
      issued_date: payload.issued_date || null,
      expiry_date: payload.expiry_date || null,
      document_url: payload.document_url?.trim() || null,
      notes: payload.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: c.tenantId,
    userId: c.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: data.id,
    newData: { kind: "employee_credential_create", credential_type: payload.credential_type },
  });

  revalidatePath("/verification");
  return { id: data.id };
}

export async function updateCredential(id: string, payload: CredentialPayload): Promise<{ ok?: boolean; error?: string }> {
  let c;
  try { c = await ctx(); } catch (e) { return { error: e instanceof Error ? e.message : "Auth failed" }; }
  if (!["owner", "admin", "manager"].includes(c.role)) {
    return { error: "Only owner or manager can update credentials." };
  }

  const { error } = await c.admin
    .from("employee_credentials")
    .update({
      employee_name: payload.employee_name.trim(),
      credential_type: payload.credential_type.trim(),
      user_id: payload.user_id ?? null,
      issuer: payload.issuer?.trim() || null,
      issued_date: payload.issued_date || null,
      expiry_date: payload.expiry_date || null,
      document_url: payload.document_url?.trim() || null,
      notes: payload.notes?.trim() || null,
    })
    .eq("id", id)
    .eq("tenant_id", c.tenantId);

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: c.tenantId,
    userId: c.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: id,
    newData: { kind: "employee_credential_update" },
  });

  revalidatePath("/verification");
  return { ok: true };
}

export async function deleteCredential(id: string): Promise<{ ok?: boolean; error?: string }> {
  let c;
  try { c = await ctx(); } catch (e) { return { error: e instanceof Error ? e.message : "Auth failed" }; }
  if (!["owner", "admin", "manager"].includes(c.role)) {
    return { error: "Only owner or manager can delete credentials." };
  }
  const { error } = await c.admin
    .from("employee_credentials")
    .delete()
    .eq("id", id)
    .eq("tenant_id", c.tenantId);
  if (error) return { error: error.message };
  await logAuditEvent({
    tenantId: c.tenantId,
    userId: c.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: id,
    newData: { kind: "employee_credential_delete" },
  });
  revalidatePath("/verification");
  return { ok: true };
}
