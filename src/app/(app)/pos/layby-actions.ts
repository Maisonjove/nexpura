"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { withIdempotency, createPaymentFingerprint } from "@/lib/idempotency";
import { logAuditEvent } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth-context";

export async function recordLaybyPayment(
  saleId: string,
  amount: number,
  paymentMethod: string,
  notes: string,
): Promise<{ error?: string; completed?: boolean }> {
  if (!saleId || amount <= 0) return { error: "Invalid payment amount" };

  // SECURITY: Session-derive tenantId and userId. Previously (W3-CRIT-04)
  // this action took tenantId as a positional arg from the client, allowing
  // cross-tenant layby payment recording.
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Not authenticated" };
  const tenantId = ctx.tenantId;
  const paidBy = ctx.userId;

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
        paid_by: paidBy,
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
        const completeResult = await completeLayby(saleId);
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

  // Audit log the layby payment
  await logAuditEvent({
    tenantId,
    action: 'layby_payment',
    entityType: 'layby',
    entityId: saleId,
    newData: { amount, paymentMethod, notes },
  });

  revalidatePath(`/laybys/${saleId}`);
  revalidatePath("/laybys");
  revalidatePath("/dashboard");

  return result as { error?: string; completed?: boolean };
}

export async function completeLayby(
  saleId: string,
): Promise<{ error?: string }> {
  // SECURITY: Session-derive tenantId. Previously (W3-CRIT-04) this took
  // tenantId as a positional arg from the client.
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Not authenticated" };
  const tenantId = ctx.tenantId;

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
    .update({ status: "completed" })
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

  // Stock deduction via stock_movements ONLY. Pre-fix did SELECT
  // inventory + direct UPDATE (with broken CAS retry — the retry
  // path didn't re-validate that newQty >= 0) AND inserted a
  // stock_movements row. The DB trigger
  // sync_inventory_on_stock_movement_insert applies the
  // quantity_change to inventory.quantity itself, so the direct
  // UPDATE was double-applying every layby completion's stock
  // deduction. Refunds were already fixed to this pattern (refunds/
  // actions.ts and api/pos/refund/route.ts); aligning layby.
  //
  // The inventory_quantity_non_negative CHECK constraint
  // (quantity >= 0) means an insert that would drive stock negative
  // fails with a 23514 constraint violation — the trigger fires
  // BEFORE INSERT, so the constraint check happens on the would-be
  // new quantity. We catch that and roll back the sale.status.
  const itemsToDeduct = (saleItems ?? []).filter((it) => it.inventory_id);
  const movementRows = itemsToDeduct.map((item) => ({
    tenant_id: tenantId,
    inventory_id: item.inventory_id!,
    movement_type: "sale",
    quantity_change: -(item.quantity || 1),
    notes: `Layby completed — ${saleNumber}`,
  }));

  if (movementRows.length > 0) {
    const { error: stockMoveErr } = await admin
      .from("stock_movements")
      .insert(movementRows);
    if (stockMoveErr) {
      // CHECK constraint violation (23514) means at least one item
      // would have gone negative. Other errors (network, FK) are
      // also fatal here. Roll back the sale.status so the layby
      // stays "layby" and can be retried after stock arrives.
      await admin
        .from("sales")
        .update({ status: "layby" })
        .eq("id", saleId)
        .eq("tenant_id", tenantId);
      const isNegativeStock = (stockMoveErr.code === "23514")
        || /quantity.*non.*negative/i.test(stockMoveErr.message ?? "");
      return {
        error: isNegativeStock
          ? "Insufficient stock for one or more layby items. Layby left as-is — receive stock first then re-complete."
          : `Failed to record stock movement: ${stockMoveErr.message}`,
      };
    }
  }

  revalidatePath(`/laybys/${saleId}`);
  revalidatePath("/laybys");
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return {};
}
