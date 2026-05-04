"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendJobReadyEmail } from "@/lib/email/send";
import { createNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTwilioSms } from "@/lib/twilio-sms";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { logStatusChange, sendTrackingEmail } from "@/lib/tracking";
import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { refreshDashboardStatsAsync } from "@/app/(app)/dashboard/actions";
import { resolveLocationForCreate, LOCATION_REQUIRED_MESSAGE } from "@/lib/active-location";
import { assertTenantActive } from "@/lib/assert-tenant-active";
import { bespokeCreateSchema } from "@/lib/schemas/jobs";
import { requireAuth } from "@/lib/auth-context";

import { flushSentry } from "@/lib/sentry-flush";
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

  // Paywall: reject mutations for suspended tenants. See
  // src/lib/assert-tenant-active.ts.
  await assertTenantActive(userData.tenant_id);

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
    deposit_received: bool("deposit_received"),
    final_price: num("final_price"),
    description: str("description"),
    internal_notes: str("internal_notes"),
    client_notes: str("client_notes"),
    // Tracking fields
    customer_email: str("customer_email"),
    estimated_completion_date: str("estimated_completion_date"),
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

  // Zod validation before any DB writes. See src/lib/schemas/jobs.ts.
  const rawBespoke: Record<string, unknown> = {
    customer_id: formData.get("customer_id"),
    title: formData.get("title"),
    jewellery_type: formData.get("jewellery_type"),
    order_type: formData.get("order_type"),
    metal_type: formData.get("metal_type"),
    metal_colour: formData.get("metal_colour"),
    metal_purity: formData.get("metal_purity"),
    metal_weight_grams: formData.get("metal_weight_grams"),
    due_date: formData.get("due_date"),
    deposit_due_date: formData.get("deposit_due_date"),
    priority: formData.get("priority"),
    quoted_price: formData.get("quoted_price"),
    deposit_amount: formData.get("deposit_amount"),
    final_price: formData.get("final_price"),
    customer_email: formData.get("customer_email"),
    estimated_completion_date: formData.get("estimated_completion_date"),
    description: formData.get("description"),
    internal_notes: formData.get("internal_notes"),
    client_notes: formData.get("client_notes"),
  };
  const validation = bespokeCreateSchema.safeParse(rawBespoke);
  if (!validation.success) {
    const i = validation.error.issues[0];
    return { error: `${i.path.join(".")}: ${i.message}` };
  }

  // Resolve location_id with the same policy as inventory — never silently
  // orphan a bespoke job from location-filtered views. See src/lib/active-location.ts.
  const locResolution = await resolveLocationForCreate(tenantId, userId);
  if (locResolution.needsSelection) {
    return { error: LOCATION_REQUIRED_MESSAGE };
  }
  const locationId = locResolution.locationId;

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
    location_id: locationId,
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

  // Destructive return-error: this is the initial stage row for a freshly
  // created bespoke job. If it silently fails the job exists with no stage
  // history, so the timeline view is incomplete and downstream stage
  // transitions reference a missing root — surface the error so the caller
  // can retry rather than half-create the record.
  const { error: stageInsertErr } = await supabase.from("bespoke_job_stages").insert({
    tenant_id: tenantId,
    job_id: data.id,
    stage: "enquiry",
    notes: "Job created",
    created_by: userId,
  });
  if (stageInsertErr) return { error: stageInsertErr.message };

  // Log initial status to tracking history
  await logStatusChange({
    tenantId,
    orderType: "bespoke",
    orderId: data.id,
    status: "enquiry",
    notes: "Bespoke job created",
    changedBy: userId,
  });

  // Send tracking email if customer email is provided
  const customerEmail = jobData.customer_email;
  if (customerEmail) {
    sendTrackingEmail({
      tenantId,
      orderType: "bespoke",
      orderId: data.id,
    }).catch((err) => {
      logger.error("[createBespokeJob] Failed to send tracking email:", err);
    });
  }

  after(() => {
    logAuditEvent({
      tenantId,
      userId,
      action: 'bespoke_create',
      entityType: 'bespoke_job',
      entityId: data.id,
      newData: { job_number: numData, customer_id: customerId, title: jobData.title },
    });
    revalidateTag("dashboard", "default");
    revalidateTag(CACHE_TAGS.workshop(tenantId), "default");
    after(() => refreshDashboardStatsAsync(tenantId));
  });

  revalidatePath("/bespoke");
  // logger.error fires inside the .catch() callback on the
  // sendTrackingEmail promise above. The lint rule's per-function
  // scope can't see that nested logger.error, but it queues a Sentry
  // event the same way as any in-handler logger.error. Flush before
  // redirect()'s NEXT_REDIRECT throw to drain.
  await flushSentry();
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

  after(() => {
    logAuditEvent({
      tenantId,
      userId: ctx.userId,
      action: 'bespoke_update',
      entityType: 'bespoke_job',
      entityId: id,
      newData: buildJobData(formData),
    });
    revalidateTag("dashboard", "default");
    revalidateTag(CACHE_TAGS.workshop(tenantId), "default");
    after(() => refreshDashboardStatsAsync(tenantId));
  });

  revalidatePath("/bespoke");
  revalidatePath(`/bespoke/${id}`);
  redirect(`/bespoke/${id}`);
}

// Whitelist of valid bespoke job stages. Mirrors the DB CHECK
// constraint `bespoke_jobs_stage_valid` exactly. Same defense as
// advanceRepairStage in repairs/actions.ts — catch invalid stages
// before the DB round-trip + before the BEFORE-trigger side effects
// fire (notification dispatch, status_history append, etc).
const VALID_BESPOKE_STAGES = new Set([
  "enquiry",
  "consultation",
  "intake",
  "design",
  "design_review",
  "assessed",
  "quoted",
  "approved",
  "in_progress",
  "ready",
  "collected",
  "completed",
  "cancelled",
  "on_hold",
]);

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

  if (!VALID_BESPOKE_STAGES.has(newStage)) {
    return { error: `Invalid bespoke stage "${newStage}".` };
  }

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

  // Log to order_status_history for tracking page
  await logStatusChange({
    tenantId,
    orderType: "bespoke",
    orderId: jobId,
    status: newStage,
    notes: notes || undefined,
    changedBy: userId,
  });

  // Send "ready for collection" email when stage becomes 'ready'
  if (newStage === "ready") {
    await sendJobReadyEmail(jobId);

    // Customer SMS — fire & forget. Per Joey 2026-04-30: customer-facing
    // ready notifications use SMS (lands reliably regardless of whether
    // the customer has WhatsApp installed; no Meta template approval).
    try {
      const admin = createAdminClient();
      const { data: jobData } = await admin
        .from("bespoke_jobs")
        .select("customer_id, jewellery_type, title, customers(full_name, mobile, phone), tenants(business_name, name)")
        .eq("id", jobId)
        .single();
      if (jobData) {
        type CustomerInfo = { full_name?: string; mobile?: string; phone?: string };
        type TenantInfo = { business_name?: string; name?: string };
        const customer = Array.isArray(jobData.customers)
          ? jobData.customers[0] as CustomerInfo
          : (jobData.customers as CustomerInfo | null);
        const tenantInfo = Array.isArray(jobData.tenants)
          ? jobData.tenants[0] as TenantInfo
          : (jobData.tenants as TenantInfo | null);
        const phone = customer?.mobile || customer?.phone;
        if (phone) {
          const storeName = tenantInfo?.business_name || tenantInfo?.name || "our store";
          const firstName = (customer?.full_name || "there").split(" ")[0];
          const jobType = jobData.jewellery_type
            ? jobData.jewellery_type.replace(/_/g, " ")
            : jobData.title || "bespoke piece";
          const message = `Hi ${firstName}, your ${jobType} is ready for collection at ${storeName}. Please contact us to arrange pickup.`;
          const smsResult = await sendTwilioSms(phone, message);
          if (smsResult.success) {
            // Side-effect log+continue: this is the audit row recording an
            // SMS that already went out via Twilio. The parent block is
            // explicitly fire-and-forget for the customer-ready notify path
            // (the stage transition has already been committed above). On
            // failure we surface to Sentry but do not unwind the stage move
            // — drift is accepted as a one-row sms_sends gap, not a duplicate
            // SMS to the customer.
            const { error: smsLogErr } = await admin.from("sms_sends").insert({
              tenant_id: tenantId,
              customer_id: jobData.customer_id ?? null,
              phone,
              message,
              status: "sent",
              twilio_sid: smsResult.messageId ?? null,
            });
            if (smsLogErr) {
              logger.error("[bespoke/advanceJobStage] sms_sends insert failed", { jobId, err: smsLogErr.message });
            }
          }
        }
      }
    } catch (e) {
      logger.error("[bespoke/advanceJobStage] Ready SMS failed:", e);
    }
  }

  // Send notification when stage becomes 'collected'
  if (newStage === "collected") {
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
        title: `Bespoke job #${jobData.job_number} collected`,
        body: customerName ? `${customerName}'s piece has been collected` : undefined,
        link: `/bespoke/${jobId}`,
      });
    }
  }

  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");

  await flushSentry();
  return { success: true };
}

export async function archiveBespokeJob(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  // RBAC: archiving a bespoke job is a destructive soft-delete. Mirror
  // archiveCustomer — owner/manager only.
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can archive bespoke jobs." };
    }
  } catch {
    return { error: "Not authenticated" };
  }
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
  
  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");
  revalidatePath("/bespoke");
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
