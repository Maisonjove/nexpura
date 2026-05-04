"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { requireAuth, requireRole } from "@/lib/auth-context";

import { flushSentry } from "@/lib/sentry-flush";
interface TemplateData {
  name: string;
  subject: string;
  body: string;
  template_type?: string;
}

export async function createTemplate(data: TemplateData) {
  try {
    // W5-CRIT-004: templates drive customer-facing emails — owner/manager.
    await requireRole("owner", "manager");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    // Extract variables from body
    const variableMatches = data.body.match(/\{\{\s*(\w+)\s*\}\}/g) || [];
    const variables = [...new Set(variableMatches.map((m) => m.replace(/[{}\s]/g, "")))];

    const { data: template, error } = await admin
      .from("email_templates")
      .insert({
        tenant_id: userData.tenant_id,
        name: data.name,
        subject: data.subject,
        body: data.body,
        template_type: data.template_type || null,
        is_system: false,
        variables,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath("/marketing/templates");
    return { success: true, template };
  } catch (error) {
    logger.error("createTemplate failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function updateTemplate(id: string, data: Partial<TemplateData>) {
  try {
    // W5-CRIT-004: owner/manager only.
    await requireRole("owner", "manager");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    // Extract variables if body is being updated
    const updateData: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };
    if (data.body) {
      const variableMatches = data.body.match(/\{\{\s*(\w+)\s*\}\}/g) || [];
      updateData.variables = [...new Set(variableMatches.map((m) => m.replace(/[{}\s]/g, "")))];
    }

    const { error } = await admin
      .from("email_templates")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (error) return { error: error.message };

    revalidatePath("/marketing/templates");
    return { success: true };
  } catch (error) {
    logger.error("updateTemplate failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function deleteTemplate(id: string) {
  try {
    // RBAC: templates drive customer-facing emails. Owner/manager only.
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete email templates." };
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    // Check template is not system
    const { data: existing } = await admin
      .from("email_templates")
      .select("is_system")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!existing) return { error: "Template not found" };
    if (existing.is_system) return { error: "Cannot delete system templates" };

    const { error } = await admin
      .from("email_templates")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/marketing/templates");
    return { success: true };
  } catch (error) {
    logger.error("deleteTemplate failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function duplicateTemplate(id: string) {
  try {
    // W5-CRIT-004: owner/manager only (duplicate creates a sendable copy).
    await requireRole("owner", "manager");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    const { data: original } = await admin
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!original) return { error: "Template not found" };

    const { data: newTemplate, error } = await admin
      .from("email_templates")
      .insert({
        tenant_id: userData.tenant_id,
        name: `${original.name} (Copy)`,
        subject: original.subject,
        body: original.body,
        template_type: original.template_type,
        is_system: false,
        variables: original.variables,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath("/marketing/templates");
    return { success: true, template: newTemplate };
  } catch (error) {
    logger.error("duplicateTemplate failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}
