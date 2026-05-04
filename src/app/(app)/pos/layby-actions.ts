"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { withIdempotency, createPaymentFingerprint } from "@/lib/idempotency";
import { logAuditEvent } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth-context";
import logger from "@/lib/logger";
import { flushSentry } from "@/lib/sentry-flush";

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
      // Destructive return-error: sales.amount_paid is the running total
      // shown on the layby ledger. The layby_payment row above is already
      // committed (immutable). If this update silently fails the UI shows
      // a stale paid amount → staff may collect twice or release the item
      // before all payments are reflected. Surface so the caller can retry
      // (the payment row idempotency key prevents double-insert on retry).
      const { error: paidUpdErr } = await admin
        .from("sales")
        .update({ amount_paid: finalPaid })
        .eq("id", saleId)
        .eq("tenant_id", tenantId);
      if (paidUpdErr) return { error: paidUpdErr.message };

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
      //
      // Side-effect log+continue on rollback failure: we're already in
      // an error path returning to the caller. If this rollback ALSO
      // fails the sale is stuck in 'completed' with no stock deduction
      // (over-sell vector). We surface the rollback failure to Sentry
      // so an admin can manually flip the row back, but we still
      // return the original stock-movement error to the caller — there
      // is no clean recovery from here in-band.
      const { error: rollbackErr } = await admin
        .from("sales")
        .update({ status: "layby" })
        .eq("id", saleId)
        .eq("tenant_id", tenantId);
      if (rollbackErr) {
        logger.error("[completeLayby] CRITICAL: status rollback failed after stock-move error — sale stuck in 'completed' with no stock deduction", {
          saleId,
          tenantId,
          stockMoveErr: stockMoveErr.message,
          rollbackErr: rollbackErr.message,
        });
        await flushSentry();
      }
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

/**
 * Cancel an active layby. Per spec, this issues store credit to the
 * customer for everything they've paid in (deposit + instalments) so
 * they can use it on a future purchase. Inventory is NOT deducted (the
 * goods stay in stock since the customer never collected). The sale row
 * stays around with status='cancelled' for audit + reporting.
 */
export async function cancelLayby(
  saleId: string,
  notes?: string,
): Promise<{ success?: boolean; storeCredit?: number; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Not authenticated" };
  const tenantId = ctx.tenantId;
  const admin = createAdminClient();

  const { data: sale } = await admin
    .from("sales")
    .select("id, sale_number, status, amount_paid, customer_id, customer_name")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();
  if (!sale) return { error: "Layby not found" };
  if (sale.status !== "layby") return { error: "Layby is not active — cannot cancel." };

  const refundAmount = Number(sale.amount_paid ?? 0);

  // Issue store credit if there's a linked customer and they paid anything
  if (sale.customer_id && refundAmount > 0) {
    const { data: cust } = await admin
      .from("customers")
      .select("store_credit")
      .eq("id", sale.customer_id)
      .eq("tenant_id", tenantId)
      .single();
    if (cust) {
      const newCredit = Number(cust.store_credit ?? 0) + refundAmount;
      // Destructive return-error: store_credit is real spendable balance
      // owed to the customer. We're cancelling a layby and crediting the
      // customer for everything they paid in. If this update silently
      // fails the customer is told "deposit refunded as store credit"
      // (status flip below) but their store_credit balance is unchanged
      // → real money drift. Surface so the caller can retry BEFORE the
      // sale is flipped to 'cancelled'.
      const { error: creditErr } = await admin
        .from("customers")
        .update({ store_credit: newCredit })
        .eq("id", sale.customer_id)
        .eq("tenant_id", tenantId);
      if (creditErr) return { error: `Failed to credit customer: ${creditErr.message}` };
    }
  }

  // Flip status to cancelled
  const { error: upErr } = await admin
    .from("sales")
    .update({
      status: "cancelled",
      notes: notes ? `Layby cancelled: ${notes}` : "Layby cancelled — deposit refunded as store credit",
    })
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .eq("status", "layby");
  if (upErr) return { error: upErr.message };

  revalidatePath("/laybys");
  revalidatePath(`/laybys/${saleId}`);
  revalidatePath("/dashboard");
  return { success: true, storeCredit: refundAmount };
}

/**
 * Mark a completed layby as physically collected by the customer.
 * Distinct from completeLayby (which marks the schedule fully paid).
 * Uses the sales.collected_status column (added by an earlier migration);
 * if the column doesn't exist on the live schema, the update is a no-op
 * gracefully and the action returns without erroring.
 */
export async function markLaybyCollected(
  saleId: string,
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Not authenticated" };
  const tenantId = ctx.tenantId;
  const admin = createAdminClient();

  const { data: sale } = await admin
    .from("sales")
    .select("status")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();
  if (!sale) return { error: "Layby not found" };
  if (sale.status !== "completed") {
    return { error: "Mark complete first — only fully-paid laybys can be collected." };
  }

  // The notes column is universal; stamp collected_at via a tagged note.
  const { error: upErr } = await admin
    .from("sales")
    .update({ collection_status: "collected" })
    .eq("id", saleId)
    .eq("tenant_id", tenantId);
  // If the column is absent, fall back to writing the marker into notes.
  if (upErr && /column.*does not exist/i.test(upErr.message)) {
    // Destructive return-error: this is the schema-fallback path when
    // collection_status column is missing — we stamp the collected
    // timestamp into notes instead. If THIS silently fails too, the
    // sale has no record of being collected → staff don't know if the
    // customer has the goods, and an audit shows a gap. Surface so the
    // caller knows the collection was not recorded.
    const { error: noteErr } = await admin
      .from("sales")
      .update({ notes: `Collected ${new Date().toISOString()}` })
      .eq("id", saleId)
      .eq("tenant_id", tenantId);
    if (noteErr) return { error: noteErr.message };
  } else if (upErr) {
    return { error: upErr.message };
  }

  revalidatePath(`/laybys/${saleId}`);
  return { success: true };
}
