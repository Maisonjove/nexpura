"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, admin: createAdminClient(), userId: user.id, tenantId: userData.tenant_id };
}

export interface RefundItemInput {
  original_sale_item_id: string | null;
  inventory_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  restock: boolean;
}

export async function processRefund(params: {
  originalSaleId: string;
  reason: string;
  refundMethod: string;
  items: RefundItemInput[];
  notes?: string;
}): Promise<{ id?: string; refundNumber?: string; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, userId, tenantId } = ctx;

  // Validate original sale belongs to tenant
  const { data: sale } = await admin
    .from("sales")
    .select("*")
    .eq("id", params.originalSaleId)
    .eq("tenant_id", tenantId)
    .single();

  if (!sale) return { error: "Original sale not found" };
  if (params.items.length === 0) return { error: "Select at least one item to refund" };

  // Generate refund number
  const { count } = await admin
    .from("refunds")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const refundNumber = `REF-${String((count ?? 0) + 1).padStart(4, "0")}`;

  // Fetch tenant tax config
  const { data: tenantData } = await admin
    .from("tenants")
    .select("tax_rate")
    .eq("id", tenantId)
    .single();
  const taxRate = tenantData?.tax_rate ?? 0.1;

  const subtotal = params.items.reduce((sum, i) => sum + i.line_total, 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  // Create refund record
  const { data: refund, error: refundErr } = await admin
    .from("refunds")
    .insert({
      tenant_id: tenantId,
      refund_number: refundNumber,
      original_sale_id: params.originalSaleId,
      customer_id: sale.customer_id ?? null,
      customer_name: sale.customer_name ?? null,
      customer_email: sale.customer_email ?? null,
      reason: params.reason,
      refund_method: params.refundMethod,
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: params.notes ?? null,
      status: "completed",
      processed_by: userId,
    })
    .select("id")
    .single();

  if (refundErr || !refund) return { error: refundErr?.message ?? "Failed to create refund" };

  // If refunding to store credit, update customer balance
  if (params.refundMethod === "store_credit") {
    if (!sale.customer_id) {
      // Rollback or handle error? For now, we'll return error if no customer
      return { error: "Customer required for store credit refund" };
    }

    const { data: customer } = await admin
      .from("customers")
      .select("store_credit")
      .eq("id", sale.customer_id)
      .eq("tenant_id", tenantId)
      .single();

    const newBalance = (customer?.store_credit || 0) + total;

    await admin
      .from("customers")
      .update({ store_credit: newBalance })
      .eq("id", sale.customer_id)
      .eq("tenant_id", tenantId);

    // Record credit history
    await admin.from("customer_store_credit_history").insert({
      tenant_id: tenantId,
      customer_id: sale.customer_id,
      amount: total,
      balance_after: newBalance,
      reason: "Refund",
      reference_type: "refund",
      reference_id: refund.id,
      created_by: userId,
    });
  }

  // Insert refund items
  const refundItemsData = params.items.map((item) => ({
    tenant_id: tenantId,
    refund_id: refund.id,
    original_sale_item_id: item.original_sale_item_id,
    inventory_id: item.inventory_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    restock: item.restock,
  }));

  await admin.from("refund_items").insert(refundItemsData);

  // Return stock to inventory for items marked for restock
  for (const item of params.items.filter((i) => i.restock && i.inventory_id)) {
    const { data: inv } = await admin
      .from("inventory")
      .select("quantity")
      .eq("id", item.inventory_id!)
      .eq("tenant_id", tenantId)
      .single();

    if (inv) {
      const newQty = inv.quantity + item.quantity;
      await admin
        .from("inventory")
        .update({ quantity: newQty })
        .eq("id", item.inventory_id!)
        .eq("tenant_id", tenantId);

      await admin.from("stock_movements").insert({
        tenant_id: tenantId,
        inventory_id: item.inventory_id!,
        movement_type: "return",
        quantity_change: item.quantity,
        quantity_after: newQty,
        notes: `Refund ${refundNumber}`,
        created_by: userId,
      });
    }
  }

  // Update original sale status to refunded
  await admin
    .from("sales")
    .update({ status: "refunded" })
    .eq("id", params.originalSaleId)
    .eq("tenant_id", tenantId);

  redirect(`/refunds/${refund.id}`);
}

export async function getRefunds() {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { data: null, error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;
  const { data, error } = await admin
    .from("refunds")
    .select("id, refund_number, original_sale_id, customer_name, total, refund_method, reason, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getRefundById(id: string) {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { data: null, error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;
  const { data: refund, error } = await admin
    .from("refunds")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();
  if (error || !refund) return { data: null, error: error?.message ?? "Not found" };
  const { data: items } = await admin
    .from("refund_items")
    .select("*")
    .eq("refund_id", id);
  return { data: { ...refund, items: items ?? [] }, error: null };
}
