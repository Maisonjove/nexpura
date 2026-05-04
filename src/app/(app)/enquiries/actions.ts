"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";

import { flushSentry } from "@/lib/sentry-flush";
export async function updateEnquiryStatus(
  enquiryId: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant" };

    const admin = createAdminClient();
    
    // Get old status for audit
    const { data: oldData } = await admin
      .from("shop_enquiries")
      .select("status")
      .eq("id", enquiryId)
      .eq("tenant_id", userData.tenant_id)
      .single();
    
    const { error } = await admin
      .from("shop_enquiries")
      .update({ status })
      .eq("id", enquiryId)
      .eq("tenant_id", userData.tenant_id);

    if (error) return { error: error.message };
    
    await logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: "enquiry_status_change",
      entityType: "enquiry",
      entityId: enquiryId,
      oldData: oldData || undefined,
      newData: { status },
    });
    
    revalidatePath("/enquiries");
    return { success: true };
  } catch (error) {
    logger.error("updateEnquiryStatus failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

/**
 * Convert a shop enquiry into a repair / quote / sale (Group 14
 * audit). Pre-fix: /enquiries had only status updates, no actual
 * conversion to a downstream entity. Spec: "Convert enquiry to
 * repair / quote / sale."
 *
 * Flow:
 *   1. Pull the enquiry row scoped to the tenant.
 *   2. Look up (or auto-create) a customers row by email or phone.
 *   3. Insert a destination-entity row referencing that customer with
 *      seed data carried from the enquiry (message → notes/description).
 *   4. Mark the enquiry status='converted' with metadata pointing at
 *      the new entity (so the conversion is audit-traceable + the
 *      enquiry isn't shown again or duplicated on next conversion).
 *
 * Idempotency: if the enquiry is already 'converted', returns the
 * existing destination id from metadata instead of creating a duplicate.
 */
export async function convertEnquiry(
  enquiryId: string,
  target: "repair" | "quote" | "sale",
): Promise<{ destinationId?: string; destinationType?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();
    if (!userData?.tenant_id) return { error: "No tenant" };
    const tenantId = userData.tenant_id as string;
    const role = (userData as { role?: string }).role ?? "staff";
    if (!["owner", "admin", "manager", "salesperson"].includes(role)) {
      return { error: "You don't have permission to convert enquiries." };
    }

    const admin = createAdminClient();

    const { data: enquiry } = await admin
      .from("shop_enquiries")
      .select("*")
      .eq("id", enquiryId)
      .eq("tenant_id", tenantId)
      .single();
    if (!enquiry) return { error: "Enquiry not found." };

    // Idempotency: if already converted, return the existing destination.
    const meta = (enquiry.metadata as Record<string, unknown>) ?? {};
    if (enquiry.status === "converted" && typeof meta.destination_id === "string") {
      return {
        destinationId: meta.destination_id as string,
        destinationType: (meta.destination_type as string) ?? target,
      };
    }

    // Find or create the customer row by email/phone.
    let customerId: string | null = null;
    if (enquiry.email) {
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", enquiry.email as string)
        .is("deleted_at", null)
        .maybeSingle();
      customerId = existing?.id ?? null;
    }
    if (!customerId && enquiry.phone) {
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("mobile", enquiry.phone as string)
        .is("deleted_at", null)
        .maybeSingle();
      customerId = existing?.id ?? null;
    }
    if (!customerId) {
      const { data: created, error: custErr } = await admin
        .from("customers")
        .insert({
          tenant_id: tenantId,
          full_name: (enquiry.name as string) ?? "Enquiry contact",
          email: (enquiry.email as string) ?? null,
          mobile: (enquiry.phone as string) ?? null,
        })
        .select("id")
        .single();
      if (custErr || !created) return { error: custErr?.message ?? "Failed to create customer" };
      customerId = created.id as string;
    }

    let destinationId: string | null = null;
    if (target === "repair") {
      // repairs.repair_number is auto-generated by trigger_generate_repair_number;
      // tracking_id by trigger_set_repair_tracking_id. customer_name doesn't
      // exist on this table — repairs join customer through customer_id only.
      const { data, error } = await admin
        .from("repairs")
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          customer_email: (enquiry.email as string) ?? null,
          item_type: "other",
          item_description: (enquiry.enquiry_type as string) || "From customer enquiry",
          work_description: (enquiry.message as string) ?? null,
          stage: "intake",
          quoted_price: 0,
        })
        .select("id")
        .single();
      if (error || !data) return { error: error?.message ?? "Failed to create repair" };
      destinationId = data.id as string;
    } else if (target === "quote") {
      // quote_number auto-generated by trigger_generate_quote_number; status
      // = 'draft' is one of the accepted enum values.
      const { data, error } = await admin
        .from("quotes")
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          status: "draft",
          notes: (enquiry.message as string) ?? null,
          total_amount: 0,
        })
        .select("id")
        .single();
      if (error || !data) return { error: error?.message ?? "Failed to create quote" };
      destinationId = data.id as string;
    } else if (target === "sale") {
      // sales.sale_number is NOT NULL with no default and no trigger; the
      // POS path uses the next_sale_number atomic RPC so concurrent inserts
      // don't collide on the unique sequence.
      const { data: nextNumber, error: numErr } = await admin.rpc("next_sale_number", {
        p_tenant_id: tenantId,
      });
      if (numErr) return { error: `sale_number generation failed: ${numErr.message}` };
      const { data, error } = await admin
        .from("sales")
        .insert({
          tenant_id: tenantId,
          sale_number: nextNumber,
          customer_id: customerId,
          customer_name: (enquiry.name as string) ?? null,
          customer_email: (enquiry.email as string) ?? null,
          status: "quote",
          subtotal: 0,
          total: 0,
          notes: (enquiry.message as string) ?? null,
        })
        .select("id")
        .single();
      if (error || !data) return { error: error?.message ?? "Failed to create sale" };
      destinationId = data.id as string;
    }
    if (!destinationId) return { error: "Conversion failed" };

    // Mark enquiry converted with a pointer back at the destination
    // (enables idempotency + audit trail). Surface the update error
    // explicitly — the previous version `await … .update(…)` silently
    // swallowed a 23514 status check-constraint violation on prod,
    // leaving the destination row created but the enquiry still at
    // 'new'. Status check was widened in
    // 20260503_shop_enquiries_status_widen.sql; this guard surfaces
    // any future schema drift instead of repeating that bug.
    const { error: enqUpdateErr } = await admin
      .from("shop_enquiries")
      .update({
        status: "converted",
        metadata: { ...meta, destination_type: target, destination_id: destinationId, converted_by: user.id, converted_at: new Date().toISOString() },
      })
      .eq("id", enquiryId)
      .eq("tenant_id", tenantId);
    if (enqUpdateErr) {
      logger.error("convertEnquiry: enquiry status update failed after destination created", {
        enquiryId, destinationId, target, error: enqUpdateErr.message,
      });
      await flushSentry();
      return { error: `Created ${target} but failed to mark enquiry converted: ${enqUpdateErr.message}` };
    }

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "enquiry_status_change",
      entityType: "enquiry",
      entityId: enquiryId,
      newData: { status: "converted", destination_type: target, destination_id: destinationId, customer_id: customerId },
    });

    revalidatePath("/enquiries");
    revalidatePath(`/${target === "repair" ? "repairs" : target === "quote" ? "quotes" : "sales"}`);

    return { destinationId, destinationType: target };
  } catch (error) {
    logger.error("convertEnquiry failed", { error });
    await flushSentry();
    return { error: error instanceof Error ? error.message : "Operation failed" };
  }
}
