"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { sendRepairReadyEmail, sendQuoteEmail } from "@/lib/email/send";
import { createNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logAuditEvent } from "@/lib/audit";
import logger from "@/lib/logger";
import { revalidateTag } from "next/cache";

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

async function getAuthContext(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  tenantId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  return { supabase, userId: user.id, tenantId: userData.tenant_id };
}

function buildRepairData(formData: FormData) {
  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v && v !== "" ? parseFloat(v) : null;
  };
  const str = (key: string) => (formData.get(key) as string) || null;
  const bool = (key: string) => formData.get(key) === "true";

  return {
    customer_id: str("customer_id"),
    item_type: (formData.get("item_type") as string).trim(),
    item_description: (formData.get("item_description") as string).trim(),
    metal_type: str("metal_type"),
    brand: str("brand"),
    condition_notes: str("condition_notes"),
    repair_type: (formData.get("repair_type") as string).trim(),
    work_description: str("work_description"),
    priority: str("priority") || "normal",
    due_date: str("due_date"),
    quoted_price: num("quoted_price"),
    final_price: num("final_price"),
    deposit_amount: num("deposit_amount"),
    deposit_paid: bool("deposit_paid"),
    internal_notes: str("internal_notes"),
    client_notes: str("client_notes"),
  };
}

// ────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────

export async function createRepair(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  // Generate repair number using the DB function
  const { data: numData, error: numError } = await supabase.rpc(
    "next_repair_number",
    { p_tenant_id: tenantId }
  );
  if (numError) return { error: numError.message };

  const repairData = {
    ...buildRepairData(formData),
    tenant_id: tenantId,
    created_by: userId,
    repair_number: numData as string,
    stage: "intake",
  };

  const { data, error } = await supabase
    .from("repairs")
    .insert(repairData)
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Insert initial stage entry
  await supabase.from("repair_stages").insert({
    tenant_id: tenantId,
    repair_id: data.id,
    stage: "intake",
    notes: "Repair created",
    created_by: userId,
  });

  // Audit log
  await logAuditEvent({
    tenantId,
    userId,
    action: "repair_create",
    entityType: "repair",
    entityId: data.id,
    newData: repairData as Record<string, unknown>,
  });

  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");

  redirect(`/repairs/${data.id}`);
}

export async function updateRepair(
  id: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId, userId } = ctx;
  const repairData = buildRepairData(formData);

  const { error } = await supabase
    .from("repairs")
    .update({
      ...repairData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  // Audit log
  await logAuditEvent({
    tenantId,
    userId,
    action: "repair_update",
    entityType: "repair",
    entityId: id,
    newData: repairData as Record<string, unknown>,
  });

  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");

  redirect(`/repairs/${id}`);
}

export async function advanceRepairStage(
  repairId: string,
  newStage: string,
  notes: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  // Update repair stage
  const { error: updateError } = await supabase
    .from("repairs")
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq("id", repairId)
    .eq("tenant_id", tenantId);

  if (updateError) return { error: updateError.message };

  // Append stage history (append-only)
  const { error: stageError } = await supabase
    .from("repair_stages")
    .insert({
      tenant_id: tenantId,
      repair_id: repairId,
      stage: newStage,
      notes: notes || null,
      created_by: userId,
    });

  if (stageError) return { error: stageError.message };

  // Send "repair ready" email when stage becomes 'ready'
  if (newStage === "ready") {
    await sendRepairReadyEmail(repairId);

    // WhatsApp notification — fire & forget, don't block on errors
    try {
      const admin = createAdminClient();
      const { data: repairData } = await admin
        .from("repairs")
        .select("item_type, customers(full_name, phone), tenants(business_name, name)")
        .eq("id", repairId)
        .single();
      if (repairData) {
        type CustomerInfo = { full_name?: string; phone?: string };
        type TenantInfo = { business_name?: string; name?: string };
        const customer = Array.isArray(repairData.customers)
          ? repairData.customers[0] as CustomerInfo
          : (repairData.customers as CustomerInfo | null);
        const tenantInfo = Array.isArray(repairData.tenants)
          ? repairData.tenants[0] as TenantInfo
          : (repairData.tenants as TenantInfo | null);
        const phone = customer?.phone;
        if (phone) {
          const storeName = tenantInfo?.business_name || tenantInfo?.name || "our store";
          const customerName = customer?.full_name || "Valued Customer";
          const jobType = `repair (${repairData.item_type || "jewellery"})`;
          const message = `Hi ${customerName}, your ${jobType} is ready for collection at ${storeName}. Please contact us to arrange pickup.`;
          await sendWhatsAppMessage(tenantId, phone, message);
        }
      }
    } catch (e) {
      logger.error("[repairs/advanceJobStage] WhatsApp notification failed:", e);
    }
  }

  // Send notification when stage becomes 'completed'
  if (newStage === "completed") {
    // Fetch repair details for notification
    const { data: repairData } = await supabase
      .from("repairs")
      .select("repair_number, customers(full_name)")
      .eq("id", repairId)
      .single();
    if (repairData) {
      const customerName = Array.isArray(repairData.customers)
        ? repairData.customers[0]?.full_name
        : (repairData.customers as { full_name?: string } | null)?.full_name;
      await createNotification({
        tenantId,
        type: "repair_completed",
        title: `Repair #${repairData.repair_number} ready for collection`,
        body: customerName ? `${customerName}'s item is ready` : undefined,
        link: `/repairs/${repairId}`,
      });
    }
  }

  // Audit log stage advancement
  await logAuditEvent({
    tenantId,
    userId,
    action: "repair_stage_change",
    entityType: "repair",
    entityId: repairId,
    newData: { stage: newStage, notes },
  });

  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");

  return { success: true };
}

export async function sendRepairQuoteEmail(
  repairId: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  // Fetch quoted price from repair
  const { data: repair, error: repairErr } = await supabase
    .from("repairs")
    .select("quoted_price")
    .eq("id", repairId)
    .eq("tenant_id", tenantId)
    .single();

  if (repairErr || !repair) return { error: "Repair not found" };
  if (!repair.quoted_price) return { error: "No quoted price set on this repair" };

  const result = await sendQuoteEmail(repairId, repair.quoted_price as number);
  return result;
}

export async function archiveRepair(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { error } = await supabase
    .from("repairs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  
  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");
  redirect("/repairs");
}

export async function saveRepairIntakePhotos(
  repairId: string,
  photos: string[]
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }
  const { supabase, tenantId } = ctx;
  const { error } = await supabase
    .from("repairs")
    .update({ intake_photos: photos })
    .eq("id", repairId)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };
  return { success: true };
}
