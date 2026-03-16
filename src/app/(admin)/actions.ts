"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type Plan = "boutique" | "studio" | "atelier";
type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "suspended" | "free";

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthenticated");

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!data) throw new Error("Unauthorized");
  return adminClient;
}

export async function changeTenantPlan(tenantId: string, newPlan: Plan) {
  const adminClient = await assertSuperAdmin();

  const { error } = await adminClient
    .from("subscriptions")
    .update({ plan: newPlan })
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
}

export async function changeTenantStatus(tenantId: string, newStatus: SubStatus) {
  const adminClient = await assertSuperAdmin();

  const { error } = await adminClient
    .from("subscriptions")
    .update({ status: newStatus })
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
}

export async function assignFreeForever(tenantId: string) {
  const adminClient = await assertSuperAdmin();

  await adminClient
    .from("tenants")
    .update({ is_free_forever: true, subscription_status: "free" })
    .eq("id", tenantId);

  await adminClient
    .from("subscriptions")
    .update({ status: "active" })
    .eq("tenant_id", tenantId);

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
}

export async function saveTenantAdminNotes(tenantId: string, notes: string) {
  const adminClient = await assertSuperAdmin();

  const { error } = await adminClient
    .from("tenants")
    .update({ admin_notes: notes })
    .eq("id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function deleteTenant(tenantId: string) {
  const adminClient = await assertSuperAdmin();

  // Soft delete — mark tenant as deleted
  const { error } = await adminClient
    .from("tenants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", tenantId);

  if (error) throw new Error(error.message);

  // Also cancel subscription
  await adminClient
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("tenant_id", tenantId);

  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
}

export async function forcePaidGracePeriod(tenantId: string) {
  const adminClient = await assertSuperAdmin();

  // Trigger via the cron route handler logic inline
  const graceEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  await adminClient
    .from("subscriptions")
    .update({
      status: "payment_required",
      grace_period_ends_at: graceEnd,
      grace_24h_sent: false,
    })
    .eq("tenant_id", tenantId);

  await adminClient
    .from("tenants")
    .update({
      subscription_status: "grace_period",
      grace_period_ends_at: graceEnd,
      payment_required_notified_at: new Date().toISOString(),
      is_free_forever: false,
    })
    .eq("id", tenantId);

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

  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function extendTrial(tenantId: string, days: number) {
  const adminClient = await assertSuperAdmin();
  const newDate = new Date();
  newDate.setDate(newDate.getDate() + days);
  const { error } = await adminClient
    .from("subscriptions")
    .update({
      trial_ends_at: newDate.toISOString(),
      status: "trialing",
    })
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
}
