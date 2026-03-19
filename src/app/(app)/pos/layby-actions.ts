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
    paid_at: new Date().toISOString(),
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

  // Check if overpaid after recalculation (guard against race)
  if (totalPaid > saleTotal + 0.01) {
    // This means concurrent payments pushed it over — allow it but cap at total
    await admin
      .from("sales")
      .update({ amount_paid: saleTotal })
      .eq("id", saleId)
      .eq("tenant_id", tenantId);
  } else {
    await admin
      .from("sales")
      .update({ amount_paid: totalPaid })
      .eq("id", saleId)
      .eq("tenant_id", tenantId);
  }

  revalidatePath(`/laybys/${saleId}`);
  revalidatePath("/laybys");
  revalidatePath("/dashboard");

  // Auto-complete if fully paid
  if (totalPaid >= saleTotal - 0.01) {
    const result = await completeLayby(saleId, tenantId);
    if (result.error) {
      // If completion fails (e.g., already completed by concurrent call), still return success for the payment
      if (result.error.includes("already completed")) {
        return { completed: true };
      }
      return { error: result.error };
    }
    return { completed: true };
  }

  return {};
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
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return {};
}
