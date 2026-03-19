"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { withIdempotency, createPaymentFingerprint } from "@/lib/idempotency";

export async function recordLaybyPayment(
  saleId: string,
  tenantId: string,
  amount: number,
  paymentMethod: string,
  notes: string,
  paidBy?: string
): Promise<{ error?: string; completed?: boolean }> {
  if (!saleId || amount <= 0) return { error: "Invalid payment amount" };

  // IDEMPOTENCY: Prevent duplicate layby payment submissions
  const paidAt = new Date().toISOString();
  const fingerprint = createPaymentFingerprint(amount, paymentMethod, paidAt.split("T")[0]);
  const result = await withIdempotency(
    "layby_payment",
    tenantId,
    saleId,
    fingerprint,
    async () => {
      const admin = createAdminClient();

      // Verify sale exists and is still a layby
      const { data: sale, error: saleErr } = await admin
        .from("sales")
        .select("id, total, status, tenant_id")
        .eq("id", saleId)
        .eq("tenant_id", tenantId)
        .single();

      if (saleErr || !sale) return { error: "Layby not found" };
      if (sale.status === "completed") return { error: "Layby already completed" };
      if (sale.status !== "layby") return { error: "Sale is not an active layby" };

      // Insert payment record first (immutable)
      const { error: payErr } = await admin.from("layby_payments").insert({
        tenant_id: tenantId,
        sale_id: saleId,
        amount,
        payment_method: paymentMethod,
        notes: notes || null,
        paid_by: paidBy || null,
        paid_at: paidAt,
      });

      if (payErr) return { error: payErr.message };

      // ATOMIC: recalculate total from all payments (race-safe)
      const { data: allPayments } = await admin
        .from("layby_payments")
        .select("amount")
        .eq("sale_id", saleId)
        .eq("tenant_id", tenantId);

      const totalPaid = (allPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const saleTotal = sale.total || 0;

      // Cap at total to prevent overpayment display issues
      const finalPaid = Math.min(totalPaid, saleTotal);
      await admin
        .from("sales")
        .update({ amount_paid: finalPaid })
        .eq("id", saleId)
        .eq("tenant_id", tenantId);

      // Auto-complete if fully paid
      if (totalPaid >= saleTotal - 0.01) {
        const completeResult = await completeLayby(saleId, tenantId);
        if (completeResult.error) {
          if (completeResult.error.includes("already completed")) {
            return { completed: true };
          }
          return { error: completeResult.error };
        }
        return { completed: true };
      }

      return {};
    }
  );

  if ("duplicate" in result && result.duplicate) {
    return { error: result.error };
  }

  revalidatePath(`/laybys/${saleId}`);
  revalidatePath("/laybys");
  revalidatePath("/dashboard");

  return result as { error?: string; completed?: boolean };
}

export async function completeLayby(
  saleId: string,
  tenantId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  // GUARD: Check current status before completing (prevent double-completion)
  const { data: saleCheck } = await admin
    .from("sales")
    .select("status, sale_number")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();

  if (!saleCheck) return { error: "Layby not found" };
  if (saleCheck.status === "completed") return { error: "Layby already completed" };
  if (saleCheck.status !== "layby") return { error: "Sale is not an active layby" };

  const saleNumber = saleCheck.sale_number ?? saleId;

  // Mark sale as completed (atomic status transition)
  const { error: updateErr, count } = await admin
    .from("sales")
    .update({ status: "completed", paid_at: new Date().toISOString() })
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .eq("status", "layby"); // Only update if still 'layby' — prevents race

  if (updateErr) return { error: updateErr.message };
  if (count === 0) return { error: "Layby was already completed or modified" };

  // Get sale items to deduct inventory
  const { data: saleItems } = await admin
    .from("sale_items")
    .select("inventory_id, quantity, description")
    .eq("sale_id", saleId)
    .eq("tenant_id", tenantId);

  for (const item of saleItems || []) {
    if (!item.inventory_id) continue;

    const { data: inv } = await admin
      .from("inventory")
      .select("quantity")
      .eq("id", item.inventory_id)
      .eq("tenant_id", tenantId)
      .single();

    if (inv) {
      const oldQty = inv.quantity || 0;
      const qty = item.quantity || 1;
      const newQty = oldQty - qty;

      // HARD FAIL: Do not allow completion if insufficient stock
      if (newQty < 0) {
        // Rollback layby status
        await admin
          .from("sales")
          .update({ status: "layby", paid_at: null })
          .eq("id", saleId)
          .eq("tenant_id", tenantId);
        return { error: `Insufficient stock for "${item.description}". Available: ${oldQty}, Required: ${qty}` };
      }

      // Conditional update with retry
      const { count: updateCount } = await admin
        .from("inventory")
        .update({ quantity: newQty })
        .eq("id", item.inventory_id)
        .eq("tenant_id", tenantId)
        .eq("quantity", oldQty);

      let finalQty = newQty;
      if (updateCount === 0) {
        // Race occurred — retry
        const { data: invRetry } = await admin
          .from("inventory")
          .select("quantity")
          .eq("id", item.inventory_id)
          .eq("tenant_id", tenantId)
          .single();
        if (invRetry) {
          finalQty = (invRetry.quantity || 0) - qty;
          if (finalQty < 0) {
            await admin
              .from("sales")
              .update({ status: "layby", paid_at: null })
              .eq("id", saleId)
              .eq("tenant_id", tenantId);
            return { error: `Item "${item.description}" just sold out. Cannot complete layby.` };
          }
          await admin
            .from("inventory")
            .update({ quantity: finalQty })
            .eq("id", item.inventory_id)
            .eq("tenant_id", tenantId);
        }
      }

      await admin.from("stock_movements").insert({
        tenant_id: tenantId,
        inventory_id: item.inventory_id,
        movement_type: "sale",
        quantity_change: -qty,
        quantity_after: finalQty,
        notes: `Layby completed — ${saleNumber}`,
      });
    }
  }

  revalidatePath(`/laybys/${saleId}`);
  revalidatePath("/laybys");
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return {};
}
