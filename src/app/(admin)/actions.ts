"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type Plan = "basic" | "pro" | "ultimate";
type SubStatus = "trialing" | "active" | "past_due" | "canceled";

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
