"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createSupportAccessRequest } from "@/lib/support-access";
import { sendSupportAccessRequestEmail } from "@/lib/email/send";
import { isAllowlistedAdmin } from "@/lib/admin-allowlist";
import logger from "@/lib/logger";

type Plan = "boutique" | "studio" | "atelier" | "group";
type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "suspended" | "free";

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  // Hard email allowlist check before the super_admins lookup so an
  // accidental super_admins row never grants platform-admin powers.
  if (!isAllowlistedAdmin(user.email)) throw new Error("Unauthorized");
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!data) throw new Error("Unauthorized");
  return { adminClient, adminUserId: user.id };
}

async function logActivity(
  adminClient: ReturnType<typeof createAdminClient>,
  adminUserId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  // Side-effect log+continue: this is an admin audit-log helper that wraps
  // every super-admin mutation; if the audit insert fails we want to surface
  // the failure to Sentry but NOT break the underlying admin action (e.g.
  // changing a tenant plan must succeed even if audit_logs is briefly
  // unavailable). The original try/catch caught throws but Supabase returns
  // { error } without throwing, so the bare insert was fully swallowed.
  try {
    const { error } = await adminClient.from("admin_audit_logs").insert({
      admin_user_id: adminUserId,
      action,
      metadata,
      created_at: new Date().toISOString(),
    });
    if (error) {
      logger.error("[admin] Failed to log activity:", { action, err: error.message });
    }
  } catch (err) {
    logger.error("[admin] Failed to log activity:", err);
  }
}

export async function changeTenantPlan(tenantId: string, newPlan: Plan) {
  const { adminClient, adminUserId } = await assertSuperAdmin();
  // Normalise legacy "group" to "atelier" so the DB constraint is never violated
  const normalisedPlan: "boutique" | "studio" | "atelier" =
    newPlan === "group" ? "atelier" : newPlan;

  // Check if subscription exists
  const { data: existingSub } = await adminClient
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingSub) {
    // Update existing subscription
    const { error } = await adminClient
      .from("subscriptions")
      .update({ plan: normalisedPlan })
      .eq("tenant_id", tenantId);
    if (error) {
      logger.error("[changeTenantPlan] Supabase error", {
        error: error.message,
        tenantId,
        plan: normalisedPlan,
      });
      throw new Error(error.message);
    }
    // Plan change on existing sub: only mirror plan to tenants below
    // (no subscription_status change — admin uses changeTenantStatus
    // for that). Group 16 audit: error capture added — pre-fix this
    // bare update could silently no-op (typo'd id, RLS denial, etc.)
    // and the admin would see "success" while the tenants row still
    // showed the old plan.
    const { error: tenantPlanErr } = await adminClient
      .from("tenants")
      .update({ plan: normalisedPlan })
      .eq("id", tenantId);
    if (tenantPlanErr) throw new Error(tenantPlanErr.message);
  } else {
    // Create subscription if it doesn't exist
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    const { error } = await adminClient.from("subscriptions").insert({
      tenant_id: tenantId,
      plan: normalisedPlan,
      status: "trialing",
      trial_ends_at: trialEnds.toISOString(),
    });
    if (error) {
      logger.error("[changeTenantPlan] Failed to create subscription:", error.message);
      throw new Error(error.message);
    }
    // Mirror to tenants — paywall reads tenants.subscription_status,
    // and a tenant with no prior subscription row may have stale
    // suspended/grace state on the tenants row from a wipe-and-restart.
    // Group 16 audit: error capture added (was bare).
    const { error: tenantMirrorErr } = await adminClient.from("tenants").update({
      plan: normalisedPlan,
      subscription_status: "trialing",
      grace_period_ends_at: null,
      payment_required_notified_at: null,
    }).eq("id", tenantId);
    if (tenantMirrorErr) throw new Error(tenantMirrorErr.message);
  }

  await logActivity(adminClient, adminUserId, "change_tenant_plan", {
    tenantId,
    newPlan: normalisedPlan,
    requestedPlan: newPlan,
  });

  // Revalidate admin paths
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
  // Revalidate user-facing paths so changes take effect immediately
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  revalidatePath("/settings");
  revalidatePath("/website");
}

export async function changeTenantStatus(tenantId: string, newStatus: SubStatus) {
  const { adminClient, adminUserId } = await assertSuperAdmin();

  // Subscriptions row
  const { error: subErr } = await adminClient
    .from("subscriptions")
    .update({ status: newStatus })
    .eq("tenant_id", tenantId);
  if (subErr) throw new Error(subErr.message);

  // Mirror to tenants — paywall reads tenants.subscription_status. When
  // restoring access (active/trialing/free) clear stale grace fields
  // left from a previous trial-end → grace cron transition.
  const tenantUpdate: Record<string, unknown> = {
    subscription_status: newStatus,
  };
  if (newStatus === "active" || newStatus === "trialing" || newStatus === "free") {
    tenantUpdate.grace_period_ends_at = null;
    tenantUpdate.payment_required_notified_at = null;
  }
  const { error: tenantErr } = await adminClient
    .from("tenants")
    .update(tenantUpdate)
    .eq("id", tenantId);
  if (tenantErr) throw new Error(tenantErr.message);

  await logActivity(adminClient, adminUserId, "change_tenant_status", {
    tenantId,
    newStatus,
  });

  // Revalidate admin paths
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
  // Revalidate user-facing paths so status changes take effect immediately
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  revalidatePath("/settings");
}

export async function assignFreeForever(tenantId: string) {
  const { adminClient, adminUserId } = await assertSuperAdmin();
  // Tenants row: mark free-forever + flip status. Clear stale grace
  // fields so a tenant previously in grace becomes immediately usable.
  // Group 16 audit: error capture added — pre-fix two bare updates
  // could partial-fail and the admin would see "success" while the
  // tenant ended up with one mutation applied (e.g. tenants flipped
  // but subscription cron still fighting it).
  const { error: tenantFFErr } = await adminClient
    .from("tenants")
    .update({
      is_free_forever: true,
      subscription_status: "free",
      grace_period_ends_at: null,
      payment_required_notified_at: null,
    })
    .eq("id", tenantId);
  if (tenantFFErr) throw new Error(tenantFFErr.message);
  // Subscriptions row: mirror to active so the subs cron stops trying
  // to flip them to grace/suspended. Clear any leftover grace state.
  const { error: subFFErr } = await adminClient
    .from("subscriptions")
    .update({
      status: "active",
      grace_period_ends_at: null,
      grace_24h_sent: false,
    })
    .eq("tenant_id", tenantId);
  if (subFFErr) throw new Error(subFFErr.message);

  await logActivity(adminClient, adminUserId, "assign_free_forever", { tenantId });

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
  // Revalidate user-facing paths so the tenant unblocks immediately
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  revalidatePath("/settings");
}

export async function saveTenantAdminNotes(tenantId: string, notes: string) {
  const { adminClient, adminUserId } = await assertSuperAdmin();
  const { error } = await adminClient
    .from("tenants")
    .update({ admin_notes: notes })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);
  // Group 16 audit: Joey's brief — "Each action must be audit-logged
  // with Joey's identity." This was the only mutation in the file
  // that wasn't being logged. The notes themselves can be sensitive
  // (escalation history, billing disputes, support-access reasoning),
  // and a write surface that doesn't carry an audit trail is the
  // wrong shape for a multi-admin future.
  await logActivity(adminClient, adminUserId, "save_tenant_admin_notes", {
    tenantId,
    notesLength: notes.length,
  });
  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function deleteTenant(tenantId: string) {
  const { adminClient, adminUserId } = await assertSuperAdmin();
  // Soft delete - mark tenant as deleted
  const { error } = await adminClient
    .from("tenants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);

  // Also cancel subscription. Group 16 audit: error capture added —
  // pre-fix this bare update could fail and the tenant would be
  // soft-deleted while subscriptions still showed as active, putting
  // the row in a contradictory state.
  const { error: cancelErr } = await adminClient
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("tenant_id", tenantId);
  if (cancelErr) throw new Error(cancelErr.message);

  await logActivity(adminClient, adminUserId, "delete_tenant", { tenantId });

  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
}

export async function forcePaidGracePeriod(tenantId: string) {
  const { adminClient, adminUserId } = await assertSuperAdmin();
  // Trigger via the cron route handler logic inline
  const graceEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  // Group 16 audit: error capture added on both updates — pre-fix
  // both were bare. A partial failure (e.g. tenants succeeds, subs
  // fails) would leave the tenant in mismatched state where the
  // paywall reads grace_period from the tenants row but the
  // subscription cron still has it as active and overrides.
  const { error: subsGraceErr } = await adminClient
    .from("subscriptions")
    .update({
      status: "payment_required",
      grace_period_ends_at: graceEnd,
      grace_24h_sent: false,
    })
    .eq("tenant_id", tenantId);
  if (subsGraceErr) throw new Error(subsGraceErr.message);
  const { error: tenantGraceErr } = await adminClient
    .from("tenants")
    .update({
      subscription_status: "grace_period",
      grace_period_ends_at: graceEnd,
      payment_required_notified_at: new Date().toISOString(),
      is_free_forever: false,
    })
    .eq("id", tenantId);
  if (tenantGraceErr) throw new Error(tenantGraceErr.message);

  // Send email (import inline to avoid circular)
  const { sendFreeToPaidConversionEmail } = await import("@/lib/email/send");
  const { data: owner } = await adminClient
    .from("users")
    .select("email, full_name")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .single();
  if (owner?.email) {
    const deadline = new Date(graceEnd).toLocaleString("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Australia/Sydney",
    });
    await sendFreeToPaidConversionEmail(owner.email, owner.full_name ?? "there", deadline);
  }

  await logActivity(adminClient, adminUserId, "force_paid_grace_period", {
    tenantId,
    graceEnd,
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function extendTrial(tenantId: string, days: number) {
  const { adminClient, adminUserId } = await assertSuperAdmin();
  const newDate = new Date();
  newDate.setDate(newDate.getDate() + days);

  // Update subscriptions row — extend trial + clear stale grace fields
  // left behind from a prior trial-end → grace transition.
  const { error: subErr } = await adminClient
    .from("subscriptions")
    .update({
      trial_ends_at: newDate.toISOString(),
      status: "trialing",
      grace_period_ends_at: null,
      grace_24h_sent: false,
    })
    .eq("tenant_id", tenantId);
  if (subErr) throw new Error(subErr.message);

  // Mirror to tenants — assertTenantActive (the paywall) reads
  // tenants.subscription_status, so without this the tenant stays
  // blocked even after the subscriptions row is back to "trialing".
  const { error: tenantErr } = await adminClient
    .from("tenants")
    .update({
      subscription_status: "trialing",
      grace_period_ends_at: null,
      payment_required_notified_at: null,
    })
    .eq("id", tenantId);
  if (tenantErr) throw new Error(tenantErr.message);

  await logActivity(adminClient, adminUserId, "extend_trial", { tenantId, days });

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
}

export async function requestSupportAccess(
  tenantId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  // Hard email allowlist — same gate as assertSuperAdmin
  if (!isAllowlistedAdmin(user.email)) return { success: false, error: "Unauthorized" };

  // Verify super admin
  const adminClient = createAdminClient();
  const { data: superAdmin } = await adminClient
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!superAdmin) return { success: false, error: "Unauthorized" };

  // Get tenant info and owner email
  const { data: tenant } = await adminClient
    .from("tenants")
    .select("id, name, business_name, email")
    .eq("id", tenantId)
    .single();
  if (!tenant) return { success: false, error: "Tenant not found" };

  // Get owner user email
  const { data: owner } = await adminClient
    .from("users")
    .select("email")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .single();
  const recipientEmail = tenant.email || owner?.email;
  if (!recipientEmail) {
    return { success: false, error: "Tenant has no email address" };
  }

  // Create the request
  const result = await createSupportAccessRequest({
    tenantId,
    requestedBy: user.id,
    requestedByEmail: user.email || "support@nexpura.com",
    reason,
  });
  if (!result.success) return result;

  // Send email
  const emailResult = await sendSupportAccessRequestEmail({
    tenantId,
    tenantEmail: recipientEmail,
    businessName: tenant.business_name || tenant.name || "Your Business",
    reason: reason || null,
    token: result.token!,
  });
  if (!emailResult.success) {
    return { success: false, error: `Failed to send email: ${emailResult.error}` };
  }

  // Group 16 audit: support-access requests are the highest-stakes
  // admin mutation surface (initiate read-only impersonation of a
  // tenant). Pre-fix this action only relied on
  // support_access_requests row insertion + email dispatch for its
  // audit trail — neither is a queryable admin-action history.
  // Adding to admin_audit_logs so the same UI that shows changes-by-
  // Joey for plan/status/free-forever also shows access-request
  // history.
  await logActivity(adminClient, user.id, "request_support_access", {
    tenantId,
    recipientEmail,
    reasonProvided: !!reason,
  });

  revalidatePath("/admin");
  return { success: true };
}
