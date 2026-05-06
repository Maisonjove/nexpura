"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withIdempotency } from "@/lib/idempotency";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-context";
import logger from "@/lib/logger";
import { flushSentry } from "@/lib/sentry-flush";

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
  refundType?: "full" | "partial" | "store_credit";
  items: RefundItemInput[];
  notes?: string;
  gatewayRef?: string;
  managerPin?: string;
}): Promise<{ id?: string; refundNumber?: string; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, userId, tenantId } = ctx;

  // A1 dispatch (2026-05-06): when tenants.a1_money_correctness is
  // TRUE, route through the new process_refund_v2 RPC. The RPC
  // wraps refund + items + stock + GL + parent-sale-flip in a single
  // PostgreSQL transaction — no saga rollback path, no split-state
  // failure modes. Falls through to the legacy saga flow below when
  // the flag is FALSE (default), so existing tenants are unchanged
  // until staged rollout enables the flag for them.
  const { data: tenantFlag } = await admin
    .from("tenants")
    .select("a1_money_correctness")
    .eq("id", tenantId)
    .single();

  if (tenantFlag?.a1_money_correctness === true) {
    return processRefundV2({ ...params, ctx: { admin, userId, tenantId } });
  }

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
      // SERVER-AUTHORITATIVE line totals. The client previously sent
      // `line_total` directly and we summed those — meaning a crafted
      // request with `quantity:1, unit_price:10, line_total:500` would
      // pass the bound check at remaining-refundable so long as 500 <
      // remaining, even if the original line was $10. Recompute every
      // line as quantity × unit_price ourselves and ignore whatever
      // the client put in `line_total`.
      const requestedSubtotal = params.items.reduce(
        (sum, i) => sum + Number(i.quantity ?? 0) * Number(i.unit_price ?? 0),
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

  // Generate refund number via the atomic next_refund_number RPC,
  // matching /api/pos/refund. Pre-fix used count+1 which is race-prone:
  // two concurrent refunds compute the same number, refunds_tenant_
  // number_unique fails one of them after items have been processed.
  const { data: refundNumberData, error: refundNumErr } = await admin.rpc(
    "next_refund_number",
    { p_tenant_id: tenantId },
  );
  if (refundNumErr || !refundNumberData) {
    return { error: "Failed to allocate refund number — please retry." };
  }
  const refundNumber = refundNumberData as string;

  // Fetch tenant tax config
  const { data: tenantData } = await admin
    .from("tenants")
    .select("tax_rate")
    .eq("id", tenantId)
    .single();
  const taxRate = tenantData?.tax_rate ?? 0.1;

  // Recompute subtotal server-side from quantity × unit_price for the
  // same reason as the bound check above — never trust client-supplied
  // line_total values.
  const subtotal = params.items.reduce(
    (sum, i) => sum + Number(i.quantity ?? 0) * Number(i.unit_price ?? 0),
    0,
  );
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
      // Policy: destructive return-error. Refund row is already in DB
      // ("completed") and has been money-out from the books — if this
      // retry update fails, the customer's store_credit is short by
      // `total`. Surface to UI so staff can manually reconcile rather
      // than swallow and leave a silent shortfall the customer
      // discovers on their next purchase.
      const { error: retryCreditErr } = await admin
        .from("customers")
        .update({ store_credit: finalBalance })
        .eq("id", sale.customer_id)
        .eq("tenant_id", tenantId);
      if (retryCreditErr) {
        return {
          error: `Refund recorded but store credit update failed: ${retryCreditErr.message}. Refund ID ${refund.id} — please reconcile customer balance manually.`,
        };
      }
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

  // Insert refund items — bulk insert so it succeeds-or-fails atomically.
  // Recompute line_total server-side. If the bulk insert fails after the
  // refund row is committed, roll back the refund row so we don't leave
  // a money-out record with no line-item detail.
  const refundItemsData = params.items.map((item) => ({
    tenant_id: tenantId,
    refund_id: refund.id,
    original_sale_item_id: item.original_sale_item_id,
    inventory_id: item.inventory_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: Number(item.quantity ?? 0) * Number(item.unit_price ?? 0),
    restock: item.restock,
  }));

  const { error: refundItemsErr } = await admin
    .from("refund_items")
    .insert(refundItemsData);
  if (refundItemsErr) {
    logger.error("[processRefund] refund_items insert failed — rolling back refund", {
      refundId: refund.id,
      error: refundItemsErr,
    });
    // Policy: destructive return-error. This is the saga rollback path
    // for refund_items insert failure. If the rollback delete itself
    // fails, we have a "completed" refund row with NO line items — a
    // money-out record that's invisible to the line-item ledger and
    // double-bookable on retry. Surface to UI so staff escalate instead
    // of letting the user retry and create a second refund.
    const { error: rollbackErr } = await admin
      .from("refunds")
      .delete()
      .eq("id", refund.id)
      .eq("tenant_id", tenantId);
    if (rollbackErr) {
      logger.error("[processRefund] refund rollback delete failed — orphan refund row", {
        refundId: refund.id,
        error: rollbackErr,
      });
      return {
        error: `Refund items failed AND rollback failed (refund ${refund.id} orphaned in DB). Contact support — do not retry.`,
      };
    }
    return { error: "Failed to record refund items — refund rolled back. Please retry." };
  }

  // Return stock for items marked for restock. Pre-fix this did
  // SELECT-then-UPDATE-then-INSERT which collided with the BEFORE INSERT
  // trigger sync_inventory_on_stock_movement_insert (verified
  // 2026-04-25) — every refund-restock added stock back twice. Now: only
  // emit the stock_movements row and let the trigger handle inventory
  // and quantity_after. Plus the prior CAS was buggy (count: undefined
  // without count: "exact") so it never noticed concurrent races anyway.
  for (const item of params.items.filter((i) => i.restock && i.inventory_id)) {
    // Policy: destructive return-error. Restock failure means the
    // refund completed (customer got money/credit back) but inventory
    // wasn't returned — physical stock is back on the shelf yet the
    // ledger says it sold. Subsequent sales will oversell. Surface to
    // UI so staff knows to manually adjust inventory; don't swallow.
    const { error: stockErr } = await admin.from("stock_movements").insert({
      tenant_id: tenantId,
      inventory_id: item.inventory_id!,
      movement_type: "return",
      quantity_change: item.quantity,
      notes: `Refund ${refundNumber}`,
      created_by: userId,
    });
    if (stockErr) {
      return {
        error: `Refund ${refundNumber} processed but inventory restock failed for one or more items: ${stockErr.message}. Adjust stock manually.`,
      };
    }
  }

      // Only flip the parent sale to status='refunded' when the refund
      // (this one + prior) covers the full subtotal. Pre-fix the parent
      // got stamped 'refunded' on every partial refund — subsequent UI
      // listings hid the original sale and prevented further partial
      // refunds against the remaining items.
      const fullyRefunded = requestedSubtotal + alreadyRefunded >= saleSubtotal - 0.01;
      if (fullyRefunded) {
        // Policy: destructive return-error. If this update fails, the
        // sale stays at its prior status (e.g. 'paid') even though it
        // is fully refunded — the UI's refunds list/badges go out of
        // sync with the money ledger and a staff member could attempt
        // another refund against an already-fully-refunded sale.
        const { error: saleStatusErr } = await admin
          .from("sales")
          .update({ status: "refunded" })
          .eq("id", params.originalSaleId)
          .eq("tenant_id", tenantId);
        if (saleStatusErr) {
          return {
            error: `Refund ${refundNumber} processed but parent sale status update failed: ${saleStatusErr.message}. Update sale ${params.originalSaleId} status manually.`,
          };
        }
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
    // logger.error inside the withIdempotency callback above could
    // have queued a Sentry capture even on the duplicate path (e.g.
    // a duplicate replay still ran the credit_history insert and
    // captured its failure). Flush before exit so the capture lands.
    await flushSentry();
    return { error: result.error };
  }

  const refundResult = result as { id?: string; refundNumber?: string; error?: string };
  if (refundResult.error) {
    // Same flush requirement — the error path covers any logger.error
    // inside the withIdempotency callback that triggered the bail.
    await flushSentry();
    return { error: refundResult.error };
  }

  // Pre-fix: revalidatePath('/refunds') ran right before redirect(),
  // and under Next 16 cacheComponents that chain raised
  // "Failed to parse postponed state" 500s on Vercel (same root cause
  // as the layby fix in commit 8d52e3b). Next's `redirect()` already
  // invalidates the destination page, and the /refunds list has no
  // unstable_cache wrapper that needs busting — so the revalidatePath
  // here was both wrong and unnecessary.
  //
  // logger.error fires inside the withIdempotency callback above
  // (credit-history insert + refund-items insert paths). The lint
  // rule's per-function scope can't see those nested logger.errors,
  // but they queue Sentry events the same way as any in-handler
  // logger.error. Flush before redirect()'s NEXT_REDIRECT throw to
  // drain.
  await flushSentry();
  redirect(`/refunds/${refundResult.id}`);
}

/**
 * Void a previously-processed refund. Reverses the side effects:
 *  - sale.status flips back from 'refunded' to its prior state (best-effort:
 *    if other refunds still exist on the sale, we keep 'refunded'; otherwise
 *    we restore based on the sale's amount_paid > 0 → 'paid', else 'completed')
 *  - any inventory restock entries are reversed via compensating
 *    stock_movements (movement_type='adjustment', negative quantity_change)
 *  - customer.store_credit is decremented by the refund total if it had been
 *    issued as store-credit. (We don't track which method paid the customer
 *    refund per-line; callers should review before voiding.)
 *  - refund.status flips to 'voided' (audit logged).
 *
 * Spec: Approve / cancel state machine. Void is the cancel transition.
 */

// ──────────────────────────────────────────────────────────────────
// A1 Day 2 — process_refund_v2 RPC dispatch
// ──────────────────────────────────────────────────────────────────

/**
 * 30-day window for refunds-without-PIN. Beyond this from the sale's
 * created_at (sales.completed_at doesn't exist as a column yet —
 * H-01 Day 4 will add it) the refund requires a manager PIN.
 *
 * Refunds with no original_sale_id always require a PIN regardless
 * of date — but processRefund's current shape always takes
 * originalSaleId, so that branch isn't reachable from this path.
 * Day 3 will add a /refunds/new-without-sale flow that hits this
 * predicate explicitly.
 */
const REFUND_PIN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface RpcDispatchParams {
  originalSaleId: string;
  reason: string;
  refundMethod: string;
  refundType?: "full" | "partial" | "store_credit";
  items: RefundItemInput[];
  notes?: string;
  gatewayRef?: string;
  managerPin?: string;
  ctx: {
    admin: ReturnType<typeof createAdminClient>;
    userId: string;
    tenantId: string;
  };
}

/**
 * V2 path — calls process_refund_v2 RPC after gating on:
 *   1. Sale exists + within 30-day window OR a valid manager PIN
 *      was supplied (verifyManagerPin returns valid:true).
 *   2. The RPC itself enforces tenant scope, FOR UPDATE locking,
 *      bound check, fully-refunded predicate, and the gl_entries
 *      write. See supabase/migrations/20260506_a1_process_refund_v2_rpc.sql.
 *
 * This wrapper does the auth-tier validation; the RPC does the
 * data-tier invariants. The split keeps RBAC + permission logic in
 * application code where it can read the requirePermission +
 * verifyManagerPin helpers + audit_logs.
 */
async function processRefundV2(
  p: RpcDispatchParams,
): Promise<{ id?: string; refundNumber?: string; error?: string }> {
  const { admin, userId, tenantId } = p.ctx;

  // Sale lookup for window check + customer details (the RPC fetches
  // its own copy under FOR UPDATE; this read is just for the PIN
  // gate, can be a vanilla SELECT).
  const { data: sale } = await admin
    .from("sales")
    .select("id, created_at, customer_id, customer_name, customer_email")
    .eq("id", p.originalSaleId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!sale) {
    return { error: "Original sale not found" };
  }

  // PIN-required branch: sale older than 30 days.
  const saleAgeMs = Date.now() - new Date(sale.created_at).getTime();
  const requiresPin = saleAgeMs > REFUND_PIN_WINDOW_MS;
  if (requiresPin) {
    if (!p.managerPin) {
      return {
        error:
          "This sale is older than 30 days. A manager PIN is required to refund it.",
      };
    }
    // Look up the calling user's PIN hash (callers verify their own
    // PIN; not someone else's). Same pattern as
    // /settings/manager-pin/actions.ts:verifyManagerPin.
    const { data: member } = await admin
      .from("team_members")
      .select("manager_pin_hash")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!member?.manager_pin_hash) {
      return {
        error:
          "Manager PIN required, but you haven't set one yet. Set it in Settings → Profile and retry.",
      };
    }
    const { verifyManagerPin } = await import("@/lib/manager-pin");
    const ok = await verifyManagerPin(p.managerPin, member.manager_pin_hash);
    if (!ok) {
      return { error: "Manager PIN incorrect." };
    }
  }

  // Idempotency-key fingerprint for the RPC. Matches the legacy
  // path's shape so a tenant flipping the flag mid-flow doesn't
  // duplicate.
  const itemFingerprint = p.items
    .map((i) => `${i.original_sale_item_id}:${i.quantity}`)
    .sort()
    .join(",");
  const idempotencyKey = `${p.originalSaleId}:${p.refundMethod}:${itemFingerprint}`;

  // Default refund_type if caller didn't supply: store_credit method
  // → 'store_credit', everything else → 'full'. Legacy callers don't
  // pass refundType.
  const refundType =
    p.refundType ??
    (p.refundMethod === "store_credit" ? "store_credit" : "full");

  // Map items to JSONB shape the RPC expects.
  const itemsJsonb = p.items.map((i) => ({
    original_sale_item_id: i.original_sale_item_id,
    inventory_id: i.inventory_id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    restock: i.restock,
  }));

  const { data, error } = await admin.rpc("process_refund_v2", {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_original_sale_id: p.originalSaleId,
    p_reason: p.reason,
    p_refund_method: p.refundMethod,
    p_refund_type: refundType,
    p_items: itemsJsonb,
    p_notes: p.notes ?? null,
    p_gateway_ref: p.gatewayRef ?? null,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    logger.error("[processRefundV2] RPC failed", {
      error,
      tenantId,
      saleId: p.originalSaleId,
    });
    await flushSentry();
    // Map common Postgres error codes to user-facing strings.
    if (error.code === "23514") {
      return { error: "Refund exceeds remaining refundable amount." };
    }
    if (error.code === "P0002") {
      return { error: "Original sale not found." };
    }
    return { error: error.message ?? "Refund failed. Please retry." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.refund_id) {
    return { error: "Refund failed: no row returned by RPC." };
  }

  // Audit log mirrors the legacy path's `refund_create` event so
  // /settings/activity surfaces both flag-on and flag-off refunds
  // identically. The RPC already wrote the gl_entries row.
  await logAuditEvent({
    tenantId,
    userId,
    action: "refund_create",
    entityType: "refund",
    entityId: row.refund_id,
    newData: {
      refundNumber: row.refund_number,
      glEntryId: row.gl_entry_id,
      reason: p.reason,
      refundMethod: p.refundMethod,
      refundType,
      originalSaleId: p.originalSaleId,
      itemCount: p.items.length,
      pinUsed: requiresPin,
      flowVersion: "v2",
    },
  });

  return { id: row.refund_id, refundNumber: row.refund_number };
}

export async function voidRefund(refundId: string): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to void refunds." : "Not authenticated" };
  }
  const { tenantId, userId } = ctx;
  const admin = createAdminClient();

  const { data: refund } = await admin
    .from("refunds")
    .select("*")
    .eq("id", refundId)
    .eq("tenant_id", tenantId)
    .single();
  if (!refund) return { error: "Refund not found" };
  if (refund.status === "voided") return { error: "Refund is already voided." };

  const { data: items } = await admin
    .from("refund_items")
    .select("inventory_id, quantity, restock")
    .eq("refund_id", refundId)
    .eq("tenant_id", tenantId);

  // Reverse stock_movements for any restocked items
  for (const it of items ?? []) {
    if (it.inventory_id && it.restock && it.quantity) {
      // Policy: destructive return-error. Void is a financial-reversal
      // path — if the compensating stock movement fails, the inventory
      // stays falsely-high (the original refund's restock added stock,
      // and we'd never deduct it back). Customer would have already
      // taken the goods back when the original refund was processed,
      // so phantom inventory leads to oversells. Surface to UI.
      const { error: stockReverseErr } = await admin.from("stock_movements").insert({
        tenant_id: tenantId,
        inventory_id: it.inventory_id,
        movement_type: "adjustment",
        quantity_change: -it.quantity,
        notes: `Refund ${refund.refund_number} voided`,
        created_by: userId,
      });
      if (stockReverseErr) {
        return {
          error: `Void of refund ${refund.refund_number} aborted — could not reverse inventory: ${stockReverseErr.message}. Refund still active.`,
        };
      }
    }
  }

  // Reverse store credit if this refund issued any
  if (refund.refund_method === "store_credit" && refund.customer_id && refund.total > 0) {
    const { data: cust } = await admin
      .from("customers")
      .select("store_credit")
      .eq("id", refund.customer_id)
      .eq("tenant_id", tenantId)
      .single();
    if (cust) {
      const newCredit = Math.max(0, Number(cust.store_credit ?? 0) - Number(refund.total));
      // Policy: destructive return-error. If this update fails, the
      // refund stays unvoided AND the customer keeps the store credit
      // they were originally issued — they could spend credit on a
      // refund we're trying to reverse. Surface to UI; do not flip
      // refund.status to 'voided' below if balance reversal didn't
      // succeed (return short-circuits the rest of voidRefund).
      const { error: creditReverseErr } = await admin
        .from("customers")
        .update({ store_credit: newCredit })
        .eq("id", refund.customer_id)
        .eq("tenant_id", tenantId);
      if (creditReverseErr) {
        return {
          error: `Void of refund ${refund.refund_number} aborted — could not reverse store credit: ${creditReverseErr.message}.`,
        };
      }
    }
  }

  // Decide whether to flip the parent sale's status back. If there are no other
  // active refunds against this sale, the 'refunded' badge no longer applies.
  if (refund.original_sale_id) {
    const { data: otherActiveRefunds } = await admin
      .from("refunds")
      .select("id")
      .eq("original_sale_id", refund.original_sale_id)
      .eq("tenant_id", tenantId)
      .neq("id", refundId)
      .neq("status", "voided");
    if (!otherActiveRefunds || otherActiveRefunds.length === 0) {
      const { data: parentSale } = await admin
        .from("sales")
        .select("amount_paid, total")
        .eq("id", refund.original_sale_id)
        .single();
      const restoreStatus = parentSale && Number(parentSale.amount_paid ?? 0) >= Number(parentSale.total ?? 0) - 0.01
        ? "paid"
        : "completed";
      // Policy: destructive return-error. If this update fails, the
      // parent sale stays stamped 'refunded' even though we're voiding
      // the only active refund — the sale stays hidden from staff
      // listings and unable to receive new partial refunds. Surface to
      // UI so staff can manually flip the sale back rather than have a
      // silently-stuck record.
      const { error: parentRestoreErr } = await admin
        .from("sales")
        .update({ status: restoreStatus })
        .eq("id", refund.original_sale_id)
        .eq("tenant_id", tenantId);
      if (parentRestoreErr) {
        return {
          error: `Void of refund ${refund.refund_number} aborted — parent sale status update failed: ${parentRestoreErr.message}.`,
        };
      }
    }
  }

  // Flip refund status
  const { error: upErr } = await admin
    .from("refunds")
    .update({ status: "voided" })
    .eq("id", refundId)
    .eq("tenant_id", tenantId);
  if (upErr) return { error: upErr.message };

  await logAuditEvent({
    tenantId,
    userId,
    action: "refund_create",
    entityType: "refund",
    entityId: refundId,
    newData: { voided: true, refundNumber: refund.refund_number, total: refund.total },
  }).catch(() => {});

  revalidatePath("/refunds");
  revalidatePath(`/refunds/${refundId}`);
  if (refund.original_sale_id) revalidatePath(`/sales/${refund.original_sale_id}`);
  return { success: true };
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
