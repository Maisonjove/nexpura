"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  const { supabase, tenantId } = ctx;

  const { error } = await supabase
    .from("repairs")
    .update({
      ...buildRepairData(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
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

  return { success: true };
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
  redirect("/repairs");
}
