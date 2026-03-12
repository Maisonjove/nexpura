"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { sendJobReadyEmail } from "@/lib/email/send";
import { createNotification } from "@/lib/notifications";

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

function buildJobData(formData: FormData) {
  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v && v !== "" ? parseFloat(v) : null;
  };
  const str = (key: string) => (formData.get(key) as string) || null;
  const bool = (key: string) => formData.get(key) === "true";

  return {
    title: (formData.get("title") as string).trim(),
    jewellery_type: str("jewellery_type"),
    order_type: str("order_type") || "bespoke",
    metal_type: str("metal_type"),
    metal_colour: str("metal_colour"),
    metal_purity: str("metal_purity"),
    metal_weight_grams: num("metal_weight_grams"),
    stone_type: str("stone_type"),
    stone_shape: str("stone_shape"),
    stone_carat: num("stone_carat"),
    stone_colour: str("stone_colour"),
    stone_clarity: str("stone_clarity"),
    stone_origin: str("stone_origin"),
    stone_cert_number: str("stone_cert_number"),
    ring_size: str("ring_size"),
    setting_style: str("setting_style"),
    priority: str("priority") || "normal",
    due_date: str("due_date"),
    deposit_due_date: str("deposit_due_date"),
    quoted_price: num("quoted_price"),
    deposit_amount: num("deposit_amount"),
    deposit_paid: bool("deposit_paid"),
    final_price: num("final_price"),
    description: str("description"),
    internal_notes: str("internal_notes"),
    client_notes: str("client_notes"),
  };
}

// ────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────

export async function createBespokeJob(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  // Generate job number using the DB function
  const { data: numData, error: numError } = await supabase.rpc(
    "next_job_number",
    { p_tenant_id: tenantId }
  );
  if (numError) return { error: numError.message };

  const customerId = (formData.get("customer_id") as string) || null;

  const jobData = {
    ...buildJobData(formData),
    tenant_id: tenantId,
    created_by: userId,
    job_number: numData as string,
    customer_id: customerId,
    stage: "enquiry",
  };

  const { data, error } = await supabase
    .from("bespoke_jobs")
    .insert(jobData)
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Insert initial stage entry
  await supabase.from("bespoke_job_stages").insert({
    tenant_id: tenantId,
    job_id: data.id,
    stage: "enquiry",
    notes: "Job created",
    created_by: userId,
  });

  redirect(`/bespoke/${data.id}`);
}

export async function updateBespokeJob(
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
    .from("bespoke_jobs")
    .update({
      ...buildJobData(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  redirect(`/bespoke/${id}`);
}

export async function advanceJobStage(
  jobId: string,
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

  // Update job stage
  const { error: updateError } = await supabase
    .from("bespoke_jobs")
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("tenant_id", tenantId);

  if (updateError) return { error: updateError.message };

  // Append stage history
  const { error: stageError } = await supabase
    .from("bespoke_job_stages")
    .insert({
      tenant_id: tenantId,
      job_id: jobId,
      stage: newStage,
      notes: notes || null,
      created_by: userId,
    });

  if (stageError) return { error: stageError.message };

  // Send "ready for collection" email when stage becomes 'ready'
  if (newStage === "ready") {
    await sendJobReadyEmail(jobId);
  }

  // Send notification when stage becomes 'completed'
  if (newStage === "completed") {
    const { data: jobData } = await supabase
      .from("bespoke_jobs")
      .select("job_number, customers(full_name)")
      .eq("id", jobId)
      .single();
    if (jobData) {
      const customerName = Array.isArray(jobData.customers)
        ? jobData.customers[0]?.full_name
        : (jobData.customers as { full_name?: string } | null)?.full_name;
      await createNotification({
        tenantId,
        type: "job_completed",
        title: `Bespoke job #${jobData.job_number} completed`,
        body: customerName ? `${customerName}'s piece is ready` : undefined,
        link: `/bespoke/${jobId}`,
      });
    }
  }

  return { success: true };
}

export async function archiveBespokeJob(
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
    .from("bespoke_jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  redirect("/bespoke");
}

export async function saveBespokeJobImages(
  jobId: string,
  images: string[]
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }
  const { supabase, tenantId } = ctx;
  const { error } = await supabase
    .from("bespoke_jobs")
    .update({ images })
    .eq("id", jobId)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };
  return { success: true };
}
