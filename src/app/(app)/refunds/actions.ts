"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withIdempotency } from "@/lib/idempotency";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-context";
import logger from "@/lib/logger";

async function getAuthContext() {
  // Refunds are money-moving. Require (a) authenticated, (b) tenant
  // active (not suspended), (c) `create_invoices` permission — the
  // existing financial-writes permission in the permissions schema.
  // Without this, any auth'd team member could hit /refunds/new and
  // issue store credit, regardless of role. Owners pass automatically.
  const ctx = await requirePermission("create_invoices");
  const supabase = await createClient();
  return {
    supabase,
    admin: createAdminClient(),
    userId: ctx.userId,
    tenantId: ctx.tenantId,
  };
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

  // IDEMPOTENCY: Prevent duplicate refund processing
  // Fingerprint based on sale + items being refunded
  const itemFingerprint = params.items.map(i => `${i.original_sale_item_id}:${i.quantity}`).sort().join(",");
  const fingerprint = `${params.originalSaleId}:${params.refundMethod}:${itemFingerprint}`;
  
  const result = await withIdempotency(
    "refund",
    tenantId,
    params.originalSaleId,
    fingerprint,
    async () => {
      // Validate original sale belongs to tenant
      const { data: sale } = await admin
        .from("sales")
        .select("*")
        .eq("id", params.originalSaleId)
        .eq("tenant_id", tenantId)
        .single();

      if (!sale) return { error: "Original sale not found" };
      if (params.items.length === 0) return { error: "Select at least one item to refund" };

      // BOUND-CHECK: refund cannot exceed (sale.total) - (already refunded).
      // Client supplies unit_price and quantity; server never trusts that the
      // implied total stays inside the envelope of the original sale. Without
      // this, a client could craft `{ unit_price: 9999, quantity: 100 }` and
      // receive 99× the original as store credit.
      const { data: priorRefunds } = await admin
        .from("refunds")
        .select("total")
        .eq("tenant_id", tenantId)
        .eq("original_sale_id", params.originalSaleId)
        .in("status", ["completed", "processing"]);
      const alreadyRefunded = (priorRefunds ?? []).reduce(
        (sum, r) => sum + Number(r.total ?? 0),
        0,
      );
      const requestedSubtotal = params.items.reduce(
        (sum, i) => sum + Number(i.line_total ?? 0),
        0,
      );
      // tax added below; compare subtotals (pre-tax) against sale subtotal.
      const saleSubtotal = Number(sale.subtotal ?? sale.total ?? 0);
      const remainingRefundable = saleSubtotal - alreadyRefunded;
      if (requestedSubtotal <= 0) {
        return { error: "Refund subtotal must be positive." };
      }
      if (requestedSubtotal > remainingRefundable + 0.01) {
        return {
          error:
            `Refund exceeds remaining refundable amount. Sale subtotal ${saleSubtotal.toFixed(2)}, ` +
            `already refunded ${alreadyRefunded.toFixed(2)}, remaining ${remainingRefundable.toFixed(2)}, ` +
            `requested ${requestedSubtotal.toFixed(2)}.`,
        };
      }

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

  // If refunding to store credit, update customer balance ATOMICALLY
  if (params.refundMethod === "store_credit") {
    if (!sale.customer_id) {
      return { error: "Customer required for store credit refund" };
    }

    // Fetch current balance
    const { data: customer } = await admin
      .from("customers")
      .select("store_credit")
      .eq("id", sale.customer_id)
      .eq("tenant_id", tenantId)
      .single();

    const oldBalance = customer?.store_credit || 0;
    const newBalance = oldBalance + total;

    // Atomic update with conditional check to prevent race.
    // PostgREST `.update()` returns count=null unless count: "exact"
    // is requested. Without it the `=== 0` check below never fires →
    // a stale CAS goes undetected → customer is shorted the credit.
    const { error: creditErr, count: creditCount } = await admin
      .from("customers")
      .update({ store_credit: newBalance }, { count: "exact" })
      .eq("id", sale.customer_id)
      .eq("tenant_id", tenantId)
      .eq("store_credit", oldBalance); // Only if balance unchanged

    // If race occurred, retry with current balance
    let finalBalance = newBalance;
    if (creditErr || creditCount === 0) {
      const { data: customerRetry } = await admin
        .from("customers")
        .select("store_credit")
        .eq("id", sale.customer_id)
        .eq("tenant_id", tenantId)
        .single();
      finalBalance = (customerRetry?.store_credit || 0) + total;
      await admin
        .from("customers")
        .update({ store_credit: finalBalance })
        .eq("id", sale.customer_id)
        .eq("tenant_id", tenantId);
    }

    // Record credit history. The table only exposes
    // amount, reason, sale_id, refund_id, created_by — earlier code
    // wrote balance_after / reference_type / reference_id which don't
    // exist; the insert errored and the awaited promise was discarded
    // (no error check), so every store-credit refund silently lost
    // its audit row. `finalBalance` is computed for downstream uses.
    void finalBalance;
    const { error: creditHistoryErr } = await admin
      .from("customer_store_credit_history")
      .insert({
        tenant_id: tenantId,
        customer_id: sale.customer_id,
        amount: total,
        reason: "Refund",
        sale_id: sale.id,
        refund_id: refund.id,
        created_by: userId,
      });
    if (creditHistoryErr) {
      logger.error("[processRefund] credit history insert failed", { err: creditHistoryErr });
    }
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

  // Return stock for items marked for restock. Pre-fix this did
  // SELECT-then-UPDATE-then-INSERT which collided with the BEFORE INSERT
  // trigger sync_inventory_on_stock_movement_insert (verified
  // 2026-04-25) — every refund-restock added stock back twice. Now: only
  // emit the stock_movements row and let the trigger handle inventory
  // and quantity_after. Plus the prior CAS was buggy (count: undefined
  // without count: "exact") so it never noticed concurrent races anyway.
  for (const item of params.items.filter((i) => i.restock && i.inventory_id)) {
    await admin.from("stock_movements").insert({
      tenant_id: tenantId,
      inventory_id: item.inventory_id!,
      movement_type: "return",
      quantity_change: item.quantity,
      notes: `Refund ${refundNumber}`,
      created_by: userId,
    });
  }

      // Only flip the parent sale to status='refunded' when the refund
      // (this one + prior) covers the full subtotal. Pre-fix the parent
      // got stamped 'refunded' on every partial refund — subsequent UI
      // listings hid the original sale and prevented further partial
      // refunds against the remaining items.
      const fullyRefunded = requestedSubtotal + alreadyRefunded >= saleSubtotal - 0.01;
      if (fullyRefunded) {
        await admin
          .from("sales")
          .update({ status: "refunded" })
          .eq("id", params.originalSaleId)
          .eq("tenant_id", tenantId);
      }

      // Log audit event
      await logAuditEvent({
        tenantId,
        userId,
        action: "refund_create",
        entityType: "refund",
        entityId: refund.id,
        newData: { 
          refundNumber, 
          total, 
          reason: params.reason, 
          refundMethod: params.refundMethod,
          originalSaleId: params.originalSaleId,
          itemCount: params.items.length,
        },
      });

      return { id: refund.id, refundNumber };
    }
  );

  if ("duplicate" in result && result.duplicate) {
    return { error: result.error };
  }

  const refundResult = result as { id?: string; refundNumber?: string; error?: string };
  if (refundResult.error) {
    return { error: refundResult.error };
  }

  revalidatePath("/refunds");
  redirect(`/refunds/${refundResult.id}`);
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
