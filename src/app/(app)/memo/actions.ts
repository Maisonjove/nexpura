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

export interface MemoItem {
  id: string;
  tenant_id: string;
  memo_number: string | null;
  memo_type: "memo" | "consignment";
  status: string;
  supplier_id: string | null;
  supplier_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  inventory_id: string | null;
  item_name: string;
  item_description: string | null;
  sku: string | null;
  metal: string | null;
  stone: string | null;
  weight_grams: number | null;
  images: string[];
  wholesale_value: number | null;
  retail_value: number | null;
  agreed_price: number | null;
  commission_rate: number | null;
  issued_date: string;
  due_back_date: string | null;
  returned_date: string | null;
  sold_date: string | null;
  invoice_id: string | null;
  notes: string | null;
  terms: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMemoItems(type?: "memo" | "consignment"): Promise<{ data: MemoItem[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    let query = admin
      .from("memo_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (type) query = query.eq("memo_type", type);
    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: data ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getMemoItem(id: string): Promise<{ data: MemoItem | null; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("memo_items")
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

export async function createMemoItem(formData: FormData): Promise<{ id?: string; error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Generate memo number
    const memoType = formData.get("memo_type") as string ?? "memo";
    const prefix = memoType === "consignment" ? "CON" : "MEMO";
    const { count } = await admin
      .from("memo_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("memo_type", memoType);
    const memoNum = `${prefix}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data, error } = await admin
      .from("memo_items")
      .insert({
        tenant_id: tenantId,
        memo_number: memoNum,
        memo_type: memoType,
        status: "active",
        customer_name: (formData.get("customer_name") as string) || null,
        customer_email: (formData.get("customer_email") as string) || null,
        customer_phone: (formData.get("customer_phone") as string) || null,
        customer_id: (formData.get("customer_id") as string) || null,
        supplier_id: (formData.get("supplier_id") as string) || null,
        supplier_name: (formData.get("supplier_name") as string) || null,
        item_name: formData.get("item_name") as string,
        item_description: (formData.get("item_description") as string) || null,
        sku: (formData.get("sku") as string) || null,
        metal: (formData.get("metal") as string) || null,
        stone: (formData.get("stone") as string) || null,
        weight_grams: formData.get("weight_grams") ? parseFloat(formData.get("weight_grams") as string) : null,
        wholesale_value: formData.get("wholesale_value") ? parseFloat(formData.get("wholesale_value") as string) : null,
        retail_value: formData.get("retail_value") ? parseFloat(formData.get("retail_value") as string) : null,
        agreed_price: formData.get("agreed_price") ? parseFloat(formData.get("agreed_price") as string) : null,
        commission_rate: formData.get("commission_rate") ? parseFloat(formData.get("commission_rate") as string) : null,
        issued_date: (formData.get("issued_date") as string) || new Date().toISOString().split("T")[0],
        due_back_date: (formData.get("due_back_date") as string) || null,
        notes: (formData.get("notes") as string) || null,
        terms: (formData.get("terms") as string) || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    await logActivity(tenantId, userId, `created_${memoType}`, "memo_item", data?.id, formData.get("item_name") as string);
    
    await logAuditEvent({
      tenantId,
      userId,
      action: "memo_create",
      entityType: "memo",
      entityId: data?.id,
      newData: { 
        memoNumber: memoNum, 
        memoType, 
        itemName: formData.get("item_name") as string,
        customerName: (formData.get("customer_name") as string) || null,
      },
    });
    
    revalidatePath("/memo");
    return { id: data?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function updateMemoStatus(
  id: string,
  status: "active" | "returned" | "sold" | "expired" | "lost",
  extraFields?: { returned_date?: string; sold_date?: string; invoice_id?: string }
): Promise<{ error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();
    
    // Get old status for audit
    const { data: oldData } = await admin
      .from("memo_items")
      .select("status, item_name")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();
    
    const { error } = await admin
      .from("memo_items")
      .update({ status, ...extraFields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    await logActivity(tenantId, userId, `memo_status_${status}`, "memo_item", id, "");
    
    await logAuditEvent({
      tenantId,
      userId,
      action: "memo_status_change",
      entityType: "memo",
      entityId: id,
      oldData: oldData || undefined,
      newData: { status, ...extraFields },
    });
    
    revalidatePath("/memo");
    revalidatePath(`/memo/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function deleteMemoItem(id: string): Promise<{ error?: string }> {
  try {
    const { userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { error } = await admin
      .from("memo_items")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    revalidatePath("/memo");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}
