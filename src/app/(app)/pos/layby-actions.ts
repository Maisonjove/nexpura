"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function recordLaybyPayment(
  saleId: string,
  tenantId: string,
  amount: number,
  paymentMethod: string,
  notes: string,
  paidBy?: string
): Promise<{ error?: string; completed?: boolean }> {
  if (!saleId || amount <= 0) return { error: "Invalid payment amount" };

  const admin = createAdminClient();

  // Verify sale exists and is still a layby
  const { data: sale, error: saleErr } = await admin
    .from("sales")
    .select("id, total, amount_paid, status, tenant_id")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();

  if (saleErr || !sale) return { error: "Layby not found" };
  if (sale.status !== "layby") return { error: "Sale is not an active layby" };

  const remaining = (sale.total || 0) - (sale.amount_paid || 0);
  if (amount > remaining + 0.01) {
    return { error: `Payment exceeds remaining balance of $${remaining.toFixed(2)}` };
  }

  // Insert payment record
  const { error: payErr } = await admin.from("layby_payments").insert({
    tenant_id: tenantId,
    sale_id: saleId,
    amount,
    payment_method: paymentMethod,
    notes: notes || null,
    paid_by: paidBy || null,
    paid_at: new Date().toISOString(),
  });

  if (payErr) return { error: payErr.message };

  // Recalculate total amount paid
  const { data: allPayments } = await admin
    .from("layby_payments")
    .select("amount")
    .eq("sale_id", saleId)
    .eq("tenant_id", tenantId);

  const totalPaid = (allPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  await admin
    .from("sales")
    .update({ amount_paid: totalPaid })
    .eq("id", saleId)
    .eq("tenant_id", tenantId);

  revalidatePath(`/laybys/${saleId}`);
  revalidatePath("/laybys");

  // Auto-complete if fully paid
  if (totalPaid >= (sale.total || 0) - 0.01) {
    const result = await completeLayby(saleId, tenantId);
    if (result.error) return { error: result.error };
    return { completed: true };
  }

  return {};
}

export async function completeLayby(
  saleId: string,
  tenantId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  // Mark sale as completed
  const { error: updateErr } = await admin
    .from("sales")
    .update({ status: "completed", paid_at: new Date().toISOString() })
    .eq("id", saleId)
    .eq("tenant_id", tenantId);

  if (updateErr) return { error: updateErr.message };

  // Get sale items to deduct inventory
  const { data: saleItems } = await admin
    .from("sale_items")
    .select("inventory_id, quantity, description")
    .eq("sale_id", saleId)
    .eq("tenant_id", tenantId);

  // Get sale number for stock movement notes
  const { data: sale } = await admin
    .from("sales")
    .select("sale_number")
    .eq("id", saleId)
    .single();

  const saleNumber = sale?.sale_number ?? saleId;

  for (const item of saleItems || []) {
    if (!item.inventory_id) continue;

    const { data: inv } = await admin
      .from("inventory")
      .select("quantity")
      .eq("id", item.inventory_id)
      .eq("tenant_id", tenantId)
      .single();

    if (inv) {
      const newQty = Math.max(0, (inv.quantity || 0) - (item.quantity || 1));
      await admin
        .from("inventory")
        .update({ quantity: newQty })
        .eq("id", item.inventory_id)
        .eq("tenant_id", tenantId);

      await admin.from("stock_movements").insert({
        tenant_id: tenantId,
        inventory_id: item.inventory_id,
        movement_type: "sale",
        quantity_change: -(item.quantity || 1),
        quantity_after: newQty,
        notes: `Layby completed — ${saleNumber}`,
      });
    }
  }

  revalidatePath(`/laybys/${saleId}`);
  revalidatePath("/laybys");
  revalidatePath("/sales");

  return {};
}
