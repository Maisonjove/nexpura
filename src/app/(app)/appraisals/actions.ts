"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { logAuditEvent } from "@/lib/audit";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return { supabase, userId: user.id, tenantId: userData.tenant_id as string, role: userData.role as string };
}

export interface Appraisal {
  id: string;
  tenant_id: string;
  appraisal_number: string | null;
  appraisal_type: string;
  purpose: string | null;
  status: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  inventory_id: string | null;
  item_name: string;
  item_description: string | null;
  metal: string | null;
  metal_purity: string | null;
  metal_weight_grams: number | null;
  stone: string | null;
  stone_carat: number | null;
  stone_colour: string | null;
  stone_clarity: string | null;
  stone_cut: string | null;
  stone_certificate_number: string | null;
  hallmarks: string | null;
  maker_marks: string | null;
  condition: string | null;
  age_period: string | null;
  provenance: string | null;
  images: string[];
  appraised_value: number | null;
  replacement_value: number | null;
  insurance_value: number | null;
  market_value: number | null;
  appraiser_name: string | null;
  appraiser_qualifications: string | null;
  appraiser_licence: string | null;
  appraisal_date: string;
  valid_until: string | null;
  issued_at: string | null;
  methodology: string | null;
  references_used: string | null;
  notes: string | null;
  pdf_url: string | null;
  fee: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAppraisals(): Promise<{ data: Appraisal[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("appraisals")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getAppraisal(id: string): Promise<{ data: Appraisal | null; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("appraisals")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();
    if (error) return { data: null, error: error.message };
    return { data };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function createAppraisal(formData: FormData): Promise<{ id?: string; error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { count } = await admin
      .from("appraisals")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    const appraisalNum = `APR-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const parseNum = (key: string) => {
      const val = formData.get(key) as string;
      return val ? parseFloat(val) : null;
    };

    // Photos: client uploads to inventory-photos bucket and serializes
    // the resulting URL list as JSON. Spec requires at least one photo
    // — server enforces in addition to client-side gate so a forged
    // POST can't slip through.
    let images: string[] = [];
    try {
      const raw = formData.get("images") as string | null;
      if (raw) images = JSON.parse(raw);
    } catch {
      images = [];
    }
    if (!Array.isArray(images) || images.length === 0) {
      return { error: "At least one photo is required for an appraisal." };
    }

    const { data, error } = await admin
      .from("appraisals")
      .insert({
        tenant_id: tenantId,
        appraisal_number: appraisalNum,
        appraisal_type: (formData.get("appraisal_type") as string) || "insurance",
        purpose: (formData.get("purpose") as string) || null,
        status: "draft",
        customer_id: (formData.get("customer_id") as string) || null,
        customer_name: formData.get("customer_name") as string,
        customer_email: (formData.get("customer_email") as string) || null,
        customer_phone: (formData.get("customer_phone") as string) || null,
        customer_address: (formData.get("customer_address") as string) || null,
        item_name: formData.get("item_name") as string,
        item_description: (formData.get("item_description") as string) || null,
        metal: (formData.get("metal") as string) || null,
        metal_purity: (formData.get("metal_purity") as string) || null,
        metal_weight_grams: parseNum("metal_weight_grams"),
        stone: (formData.get("stone") as string) || null,
        stone_carat: parseNum("stone_carat"),
        stone_colour: (formData.get("stone_colour") as string) || null,
        stone_clarity: (formData.get("stone_clarity") as string) || null,
        stone_cut: (formData.get("stone_cut") as string) || null,
        stone_certificate_number: (formData.get("stone_certificate_number") as string) || null,
        hallmarks: (formData.get("hallmarks") as string) || null,
        maker_marks: (formData.get("maker_marks") as string) || null,
        condition: (formData.get("condition") as string) || "good",
        age_period: (formData.get("age_period") as string) || null,
        provenance: (formData.get("provenance") as string) || null,
        appraised_value: parseNum("appraised_value"),
        replacement_value: parseNum("replacement_value"),
        insurance_value: parseNum("insurance_value"),
        market_value: parseNum("market_value"),
        appraiser_name: (formData.get("appraiser_name") as string) || null,
        appraiser_qualifications: (formData.get("appraiser_qualifications") as string) || null,
        appraiser_licence: (formData.get("appraiser_licence") as string) || null,
        appraisal_date: (formData.get("appraisal_date") as string) || new Date().toISOString().split("T")[0],
        valid_until: (formData.get("valid_until") as string) || null,
        methodology: (formData.get("methodology") as string) || null,
        notes: (formData.get("notes") as string) || null,
        fee: parseNum("fee"),
        images,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    await logActivity(tenantId, userId, "created_appraisal", "appraisal", data?.id, formData.get("item_name") as string);
    
    await logAuditEvent({
      tenantId,
      userId,
      action: "appraisal_create",
      entityType: "appraisal",
      entityId: data?.id,
      newData: { 
        appraisalNumber: appraisalNum, 
        itemName: formData.get("item_name") as string,
        customerName: formData.get("customer_name") as string,
        appraisedValue: parseNum("appraised_value"),
      },
    });
    
    revalidatePath("/appraisals");
    return { id: data?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function updateAppraisal(
  id: string,
  updates: Partial<Appraisal>
): Promise<{ error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();
    
    // Get old data for audit
    const { data: oldData } = await admin
      .from("appraisals")
      .select("item_name, appraised_value, status")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();
    
    // Whitelist allowed update keys. The previous shape spread `updates`
    // straight into the SET clause; a caller could ship `tenant_id`,
    // `id`, `created_by` and the WHERE filter on tenant only constrains
    // *which* row is matched, not what's overwritten — meaning a
    // malicious payload could move the appraisal cross-tenant or
    // reassign authorship.
    const allowedKeys = [
      "item_name",
      "item_description",
      "appraisal_type",
      "metal_type",
      "metal_weight_grams",
      "stone_type",
      "stone_carat",
      "stone_colour",
      "stone_clarity",
      "appraised_value",
      "currency",
      "status",
      "notes",
      "appraised_at",
      "valid_until",
      "appraiser_name",
      "appraiser_license",
      "customer_id",
      "location_id",
    ] as const;
    const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowedKeys) {
      if (key in updates) safeUpdates[key] = (updates as Record<string, unknown>)[key];
    }
    const { error } = await admin
      .from("appraisals")
      .update(safeUpdates)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    
    await logAuditEvent({
      tenantId,
      userId,
      action: "appraisal_update",
      entityType: "appraisal",
      entityId: id,
      oldData: oldData || undefined,
      newData: updates as Record<string, unknown>,
    });
    
    revalidatePath("/appraisals");
    revalidatePath(`/appraisals/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function issueAppraisal(id: string): Promise<{ error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { error } = await admin
      .from("appraisals")
      .update({ status: "issued", issued_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    await logActivity(tenantId, userId, "issued_appraisal", "appraisal", id, "");
    
    await logAuditEvent({
      tenantId,
      userId,
      action: "appraisal_issue",
      entityType: "appraisal",
      entityId: id,
      newData: { status: "issued", issued_at: new Date().toISOString() },
    });
    
    revalidatePath("/appraisals");
    revalidatePath(`/appraisals/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

/**
 * Email the appraisal certificate to the customer. Pulls the PDF route's
 * URL into the email body and uses Resend (same path as quote/invoice
 * emails). Caller must have already issued the appraisal — this is a
 * delivery, not an issue, action.
 */
export async function emailAppraisal(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { data: ap } = await admin
      .from("appraisals")
      .select("id, appraisal_number, status, customer_name, customer_email, item_name, appraised_value")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();
    if (!ap) return { error: "Appraisal not found" };
    if (!ap.customer_email) return { error: "No customer email on file." };

    const { data: tenant } = await admin
      .from("tenants")
      .select("business_name, name, email")
      .eq("id", tenantId)
      .single();
    const businessName = tenant?.business_name || tenant?.name || "Your Jeweller";
    const fromEmail = tenant?.email || "noreply@nexpura.com";

    const { Resend } = await import("resend");
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { error: "Email service is not configured." };
    const resend = new Resend(apiKey);

    const valueStr = ap.appraised_value != null
      ? `$${Number(ap.appraised_value).toFixed(2)}`
      : "see attached";

    const html = `
      <div style="font-family: Georgia, serif; max-width: 540px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #1c1917;">${businessName} Appraisal Certificate</h1>
        <p>${ap.customer_name ? `Dear ${ap.customer_name},` : "Hello,"}</p>
        <p>Please find attached the appraisal certificate for:</p>
        <div style="background: #fafaf9; border: 1px solid #e7e5e4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>${ap.item_name}</strong></p>
          <p style="margin: 0; color: #57534e;">Appraised value: ${valueStr}</p>
          <p style="margin: 8px 0 0; color: #78716c; font-size: 12px;">Reference: ${ap.appraisal_number}</p>
        </div>
        <p>The certificate PDF can be downloaded at:<br>
          <a href="https://nexpura.com/api/appraisals/${id}/pdf">View Certificate</a>
        </p>
        <p style="color: #78716c; font-size: 12px; margin-top: 24px;">— ${businessName}</p>
      </div>
    `;

    const { error: sendErr } = await resend.emails.send({
      from: `${businessName} <${fromEmail}>`,
      to: ap.customer_email,
      subject: `Your appraisal certificate from ${businessName}`,
      html,
    });
    if (sendErr) return { error: sendErr.message };

    await logActivity(tenantId, userId, "emailed_appraisal", "appraisal", id, "");
    await logAuditEvent({
      tenantId, userId, action: "appraisal_issue",
      entityType: "appraisal", entityId: id,
      newData: { emailed: true, sentTo: ap.customer_email },
    });
    revalidatePath(`/appraisals/${id}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}
