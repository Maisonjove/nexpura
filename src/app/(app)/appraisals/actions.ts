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
    
    const { error } = await admin
      .from("appraisals")
      .update({ ...updates, updated_at: new Date().toISOString() })
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
