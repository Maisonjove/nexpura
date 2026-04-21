"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { logger } from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { assertTenantActive } from "@/lib/assert-tenant-active";
import { customerCreateSchema } from "@/lib/schemas/customers";
import { requireAuth } from "@/lib/auth-context";

export type CustomerListRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  tags: string[] | null;
  is_vip: boolean | null;
  created_at: string;
  updated_at: string | null;
};

/**
 * Fetch the next batch of customers for the "Load older" client flow on
 * /customers. Returns a single page of 200 customers, ordered by created_at
 * desc. Tenant-scoped via the caller's session — same auth contract as every
 * other server action on this route.
 */
export async function loadMoreCustomers(
  offset: number
): Promise<{ customers: CustomerListRow[]; error?: string }> {
  try {
    const tenantId = await getTenantId();
    const { data: { user } } = await (await createClient()).auth.getUser();
    const userId = user?.id ?? null;
    const admin = createAdminClient();
    const pageSize = 200;

    // Location-scoped customer visibility for restricted users.
    // See migration 20260421_customer_location_visibility.sql — the
    // function returns the set of customer IDs the user is allowed
    // to see (all-access users get every tenant customer; restricted
    // users get those with activity at allowed locations OR with no
    // location-scoped activity at all).
    let visibleIds: string[] | null = null;
    if (userId) {
      const { data: member } = await admin
        .from("team_members")
        .select("allowed_location_ids")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (member && member.allowed_location_ids !== null) {
        // Restricted — fetch visible ids via the RPC.
        const { data: ids } = await admin.rpc("get_visible_customer_ids", {
          p_user_id: userId,
          p_tenant_id: tenantId,
        });
        visibleIds = (ids as unknown as { get_visible_customer_ids: string }[] | string[] | null)
          ?.map((r: unknown) => typeof r === "string" ? r : (r as { get_visible_customer_ids: string }).get_visible_customer_ids)
          ?? [];
      }
    }

    let query = admin
      .from("customers")
      .select(
        "id, full_name, first_name, last_name, email, phone, mobile, tags, is_vip, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);
    if (visibleIds !== null) {
      if (visibleIds.length === 0) return { customers: [] };
      query = query.in("id", visibleIds);
    }
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) return { customers: [], error: error.message };
    return { customers: (data ?? []) as CustomerListRow[] };
  } catch (err) {
    logger.error("loadMoreCustomers failed", { err });
    return { customers: [], error: "Failed to load more customers" };
  }
}

async function getTenantId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");
  // Paywall choke point. See src/lib/assert-tenant-active.ts.
  await assertTenantActive(userData.tenant_id);
  return userData.tenant_id;
}

function buildCustomerData(formData: FormData, tenantId?: string, userId?: string) {
  const firstName = (formData.get("first_name") as string || "").trim();
  const lastName = (formData.get("last_name") as string || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  const rawTags = formData.getAll("tags") as string[];
  const customTagsRaw = formData.get("custom_tags") as string;
  const customTags = customTagsRaw
    ? customTagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const tags = [...rawTags, ...customTags];

  return {
    ...(tenantId && { tenant_id: tenantId }),
    ...(userId && { created_by: userId }),
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    email: (formData.get("email") as string) || null,
    mobile: (formData.get("mobile") as string) || null,
    phone: (formData.get("phone") as string) || null,
    address_line1: (formData.get("address_line1") as string) || null,
    suburb: (formData.get("suburb") as string) || null,
    state: (formData.get("state") as string) || null,
    postcode: (formData.get("postcode") as string) || null,
    country: (formData.get("country") as string) || "Australia",
    ring_size: (formData.get("ring_size") as string) || null,
    preferred_metal: (formData.get("preferred_metal") as string) || null,
    birthday: (formData.get("birthday") as string) || null,
    anniversary: (formData.get("anniversary") as string) || null,
    tags: tags.length > 0 ? tags : null,
    is_vip: tags.includes("VIP"),
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createCustomer(formData: FormData): Promise<{ id?: string; error?: string; duplicateId?: string; duplicateField?: "email" | "mobile" }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    // Validate the raw FormData via Zod before it touches the DB —
    // catches malformed emails, over-long fields, non-numeric phones.
    // See src/lib/schemas/customers.ts.
    const rawFields: Record<string, unknown> = {
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      email: formData.get("email"),
      mobile: formData.get("mobile"),
      phone: formData.get("phone"),
      address_line1: formData.get("address_line1"),
      suburb: formData.get("suburb"),
      state: formData.get("state"),
      postcode: formData.get("postcode"),
      country: formData.get("country"),
      ring_size: formData.get("ring_size"),
      preferred_metal: formData.get("preferred_metal"),
      birthday: formData.get("birthday"),
      anniversary: formData.get("anniversary"),
      notes: formData.get("notes"),
      tags: formData.getAll("tags"),
    };
    const validation = customerCreateSchema.safeParse(rawFields);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      return { error: `${firstIssue.path.join(".")}: ${firstIssue.message}` };
    }

    const customerData = buildCustomerData(formData, userData.tenant_id, user.id);

    // Graceful duplicate detection: if email or mobile is supplied and a
    // customer with the same value already exists for this tenant, surface
    // the existing id so the UI can link the user to the existing record
    // instead of silently creating a duplicate. The user can still proceed
    // by clearing/changing the conflicting field.
    const normalisedEmail = customerData.email?.trim().toLowerCase() || null;
    const normalisedMobile = customerData.mobile?.replace(/\s+/g, "").trim() || null;
    if (normalisedEmail) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", userData.tenant_id)
        .ilike("email", normalisedEmail)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        return {
          error: "A customer with this email already exists.",
          duplicateId: existing.id,
          duplicateField: "email",
        };
      }
    }
    if (normalisedMobile) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", userData.tenant_id)
        .eq("mobile", normalisedMobile)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        return {
          error: "A customer with this mobile already exists.",
          duplicateId: existing.id,
          duplicateField: "mobile",
        };
      }
    }

    const { data, error } = await supabase
      .from("customers")
      .insert(customerData)
      .select("id")
      .single();

    if (error) return { error: error.message };

    after(() =>
      logAuditEvent({
        tenantId: userData.tenant_id,
        userId: user.id,
        action: "customer_create",
        entityType: "customer",
        entityId: data.id,
        newData: { full_name: customerData.full_name, email: customerData.email, phone: customerData.mobile || customerData.phone },
      })
    );

    revalidatePath("/customers");
    revalidateTag(CACHE_TAGS.customers(userData.tenant_id), "default");
    return { id: data.id };
  } catch (error) {
    logger.error("createCustomer failed", { error });
    return { error: "Operation failed" };
  }
}

export async function updateCustomer(
  id: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Verify ownership
    const tenantId = await getTenantId().catch(() => null);
    if (!tenantId) return { error: "Not authenticated" };

    const customerData = {
      ...buildCustomerData(formData),
      updated_at: new Date().toISOString(),
    };

    // Get old data for audit
    const { data: oldData } = await supabase
      .from("customers")
      .select("full_name, email, mobile, phone")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("customers")
      .update(customerData)
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };

    after(() =>
      logAuditEvent({
        tenantId,
        userId: user?.id,
        action: "customer_update",
        entityType: "customer",
        entityId: id,
        oldData: oldData || undefined,
        newData: { full_name: customerData.full_name, email: customerData.email, phone: customerData.mobile || customerData.phone },
      })
    );

    revalidatePath("/customers");
    revalidateTag(CACHE_TAGS.customers(tenantId), "default");
    revalidatePath(`/customers/${id}`);
    return { success: true };
  } catch (error) {
    logger.error("updateCustomer failed", { error });
    return { error: "Operation failed" };
  }
}

export async function archiveCustomer(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    // RBAC: archive is a destructive action — require owner or manager.
    // Low-privilege roles (salesperson, workshop, inventory, accountant)
    // can still create + update customers but cannot soft-delete them.
    const ctx = await requireAuth();
    if (!ctx.isManager && !ctx.isOwner) {
      return { error: "Only owner or manager can archive customers." };
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const tenantId = await getTenantId().catch(() => null);
    if (!tenantId) return { error: "Not authenticated" };

    // Get old data for audit
    const { data: oldData } = await supabase
      .from("customers")
      .select("full_name, email, mobile")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };

    after(() =>
      logAuditEvent({
        tenantId,
        userId: user?.id,
        action: "customer_delete",
        entityType: "customer",
        entityId: id,
        oldData: oldData || undefined,
      })
    );

    revalidatePath("/customers");
    revalidateTag(CACHE_TAGS.customers(tenantId), "default");
    redirect("/customers");
  } catch (error) {
    logger.error("archiveCustomer failed", { error });
    return { error: "Operation failed" };
  }
}

export async function addCustomerNote(
  customerId: string,
  note: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const tenantId = await getTenantId().catch(() => null);
    if (!tenantId) return { error: "Not authenticated" };

    // Fetch existing notes
    const { data: existing } = await supabase
      .from("customers")
      .select("notes")
      .eq("id", customerId)
      .eq("tenant_id", tenantId)
      .single();

    const timestamp = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
    const newNote = `[${timestamp}] ${note}`;
    const updatedNotes = existing?.notes
      ? `${existing.notes}\n\n${newNote}`
      : newNote;

    const { error } = await supabase
      .from("customers")
      .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
      .eq("id", customerId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath(`/customers/${customerId}`);
    return { success: true };
  } catch (error) {
    logger.error("addCustomerNote failed", { error });
    return { error: "Operation failed" };
  }
}
