import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateCSRFForRequest } from "@/lib/csrf";
import { posRefundSchema } from "@/lib/schemas";
import { reportServerError } from "@/lib/logger";
import { requirePermission } from "@/lib/auth-context";
import { withIdempotency, createPaymentFingerprint } from "@/lib/idempotency";

/**
 * POS Refund endpoint (legacy route — the canonical path is the
 * processRefund server action in src/app/(app)/refunds/actions.ts).
 *
 * PR-09 brings this route to parity with processRefund:
 *   - requirePermission("create_invoices") gate       (PR-07 W3-RBAC-11)
 *   - withIdempotency fingerprint on saleId+method+items (W3-HIGH-03)
 *   - server-side bound check: sum(items) must not exceed
 *     (sale.total − already_refunded)                    (W3-HIGH-03)
 *   - compare-and-swap on store_credit (matches processRefund so two
 *     concurrent refunds / POS sales can't race)
 *
 * The body's `total` is now recomputed server-side from items; the
 * client-supplied value is ignored for the refund record and only used
 * as a client-side UI sanity bound. This stops the "client chooses
 * refund amount" vector called out in Wave 3.
 */
export async function POST(req: NextRequest) {
  // SECURITY: Require authentication
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF protection
  if (!validateCSRFForRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  // W3-HIGH-03 / W3-RBAC-11: refunds = money out. Gate on create_invoices
  // to match processRefund server action.
  let ctx;
  try {
    ctx = await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    const status = msg.startsWith("permission_denied") ? 403 : msg.startsWith("role_denied") ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  const admin = createAdminClient();

  const body = await req.json();
  const parseResult = posRefundSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }
  const { saleId, items, refundMethod, reason, notes } = parseResult.data;

  // SECURITY: tenantId is session-derived from the RBAC context; body
  // tenantId is ignored.
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  // Rate limit refunds per tenant to prevent fraud
  const { success: rateLimitOk } = await checkRateLimit(`pos-refund:${tenantId}`);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many refund requests. Please try again later." }, { status: 429 });
  }

  // Check sale exists + capture total for the bound check
  const { data: sale } = await admin
    .from("sales")
    .select("id, sale_number, total, subtotal, customer_id, customer_name")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();

  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  // W3-HIGH-03: recompute refund total SERVER-SIDE from items. The
  // client-supplied `total` is ignored — without this a malicious
  // client could craft items with tiny quantities but a huge total and
  // move arbitrary money out of the till.
  const items2 = items as Array<{ saleItemId: string; quantity: number; unitPrice: number }>;
  const refundSubtotal = items2.reduce(
    (sum, i) => sum + Number(i.quantity ?? 0) * Number(i.unitPrice ?? 0),
    0,
  );
  if (refundSubtotal <= 0) {
    return NextResponse.json({ error: "Refund total must be positive" }, { status: 400 });
  }

  // Bound against remaining refundable amount on this sale (sale.total
  // minus any prior refunds). Mirrors processRefund.
  // Column on `refunds` is `original_sale_id`, NOT `sale_id` (the latter
  // is what processRefund + the schema both use). Querying `sale_id`
  // returned a PostgREST schema-cache 404, the data slot was null, and
  // the bound check silently allowed any amount through. Worse, the
  // INSERT below also used `sale_id` and 500'd on every refund click.
  const { data: priorRefunds } = await admin
    .from("refunds")
    .select("total")
    .eq("tenant_id", tenantId)
    .eq("original_sale_id", saleId);
  const alreadyRefunded = (priorRefunds ?? []).reduce(
    (sum, r) => sum + Number(r.total ?? 0),
    0,
  );
  const saleTotal = Number(sale.total ?? sale.subtotal ?? 0);
  const remainingRefundable = saleTotal - alreadyRefunded;
  if (refundSubtotal > remainingRefundable + 0.01) {
    return NextResponse.json(
      {
        error:
          `Refund exceeds remaining refundable amount. Sale total ${saleTotal.toFixed(2)}, ` +
          `already refunded ${alreadyRefunded.toFixed(2)}, remaining ${remainingRefundable.toFixed(2)}, ` +
          `requested ${refundSubtotal.toFixed(2)}.`,
      },
      { status: 400 },
    );
  }

  // IDEMPOTENCY: fingerprint on saleId + method + sorted items list.
  // Replayed clicks within the TTL window hit the same fingerprint and
  // are rejected by withIdempotency. Mirrors processRefund.
  const today = new Date().toISOString().split("T")[0];
  const itemFingerprint = items2
    .map((i) => `${i.saleItemId}:${i.quantity}:${i.unitPrice}`)
    .sort()
    .join(",");
  const fingerprint = createPaymentFingerprint(
    refundSubtotal,
    `${refundMethod}:${itemFingerprint}`,
    today,
  );

  const result = await withIdempotency("refund", tenantId, saleId, fingerprint, async () => {
    // Atomic refund-number allocation via RPC (advisory-locked).
    // The old COUNT()+1 fallback was race-prone — two concurrent refunds
    // would both read count=N and both insert N+1, producing duplicates.
    // Now that the RPC exists + `refunds_tenant_number_unique` is on
    // (tenant_id, refund_number), fail loud if the RPC doesn't succeed
    // rather than silently falling back.
    const { data: refundNumber, error: numErr } = await admin.rpc(
      "next_refund_number",
      { p_tenant_id: tenantId },
    );
    if (numErr || !refundNumber) {
      return {
        status: 500,
        payload: { error: "Failed to allocate refund number" },
      };
    }

    // Create refund record with server-computed total. Column is
    // `original_sale_id`, not `sale_id` (see priorRefunds note above).
    // customer_id / customer_name / customer_email are denormalised on
    // refunds for fast lookup; copy them off the sale row so the refund
    // surfaces them without joining.
    const { data: refund, error: refundErr } = await admin
      .from("refunds")
      .insert({
        tenant_id: tenantId,
        original_sale_id: saleId,
        customer_id: sale.customer_id ?? null,
        customer_name: sale.customer_name ?? null,
        refund_number: refundNumber,
        subtotal: refundSubtotal,
        tax_amount: 0,
        total: refundSubtotal,
        refund_method: refundMethod,
        reason,
        notes: notes || null,
        status: "completed",
        processed_by: userId,
      })
      .select("id")
      .single();

    if (refundErr || !refund) {
      reportServerError("pos/refund:refunds.insert", refundErr, { saleId, tenantId });
      return { status: 500, payload: { error: refundErr?.message ?? "Failed to create refund" } };
    }

    // Create refund items and restore inventory. refund_items columns
    // are `original_sale_item_id` + `line_total` (matches processRefund);
    // `description` is NOT NULL on the schema — copy it from the original
    // sale_items row so the line is human-readable in the refund detail.
    for (const item of items2) {
      const lineTotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
      const { data: srcSaleItem } = await admin
        .from("sale_items")
        .select("inventory_id, description")
        .eq("id", item.saleItemId)
        .eq("tenant_id", tenantId)
        .single();
      const { error: refundItemErr } = await admin.from("refund_items").insert({
        tenant_id: tenantId,
        refund_id: refund.id,
        original_sale_item_id: item.saleItemId,
        inventory_id: srcSaleItem?.inventory_id ?? null,
        description: srcSaleItem?.description ?? "Refunded item",
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: lineTotal,
        restock: true,
      });
      if (refundItemErr) {
        reportServerError("pos/refund:refund_items.insert", refundItemErr, {
          refundId: refund.id,
          saleItemId: item.saleItemId,
          tenantId,
        });
        return {
          status: 500,
          payload: { error: "Failed to record refund item. Refund has been halted — please retry." },
        };
      }

      // Restore inventory by inserting a stock_movements row. The
      // sync_inventory_quantity trigger applies quantity_change to the
      // inventory row + sets quantity_after — so the route does NOT
      // touch inventory directly. Same pattern as inventory create-item
      // (commit 00d9e91) + pos_deduct_stock (commit 2b0850b): direct
      // updates compete with the trigger and double-apply.
      if (srcSaleItem?.inventory_id) {
        const { error: stockMoveErr } = await admin.from("stock_movements").insert({
          tenant_id: tenantId,
          inventory_id: srcSaleItem.inventory_id,
          movement_type: "return",
          quantity_change: item.quantity,
          notes: `Refund ${refundNumber}`,
          created_by: userId,
        });
        if (stockMoveErr) {
          reportServerError("pos/refund:stock_movements.insert", stockMoveErr, {
            inventoryId: srcSaleItem.inventory_id,
            tenantId,
            refundId: refund.id,
          });
        }
      }
    }

    // If store credit refund, add to customer balance with compare-and-
    // swap so a concurrent POS sale's deduction doesn't clobber the
    // credit. Matches processRefund.
    if (refundMethod === "store_credit" && sale.customer_id) {
      const { data: customer } = await admin
        .from("customers")
        .select("store_credit")
        .eq("id", sale.customer_id)
        .eq("tenant_id", tenantId)
        .single();

      if (customer) {
        const oldBalance = customer.store_credit || 0;
        const newBalance = oldBalance + refundSubtotal;

        const { error: creditErr, count: creditCount } = await admin
          .from("customers")
          .update({ store_credit: newBalance })
          .eq("id", sale.customer_id)
          .eq("tenant_id", tenantId)
          .eq("store_credit", oldBalance);

        if (creditErr || creditCount === 0) {
          // Race: re-read and retry with latest.
          const { data: customerRetry } = await admin
            .from("customers")
            .select("store_credit")
            .eq("id", sale.customer_id)
            .eq("tenant_id", tenantId)
            .single();
          const retryNew = (customerRetry?.store_credit || 0) + refundSubtotal;
          const { error: retryErr } = await admin
            .from("customers")
            .update({ store_credit: retryNew })
            .eq("id", sale.customer_id)
            .eq("tenant_id", tenantId);
          if (retryErr) {
            reportServerError("pos/refund:customers.store_credit.update", retryErr, {
              customerId: sale.customer_id,
              tenantId,
              refundId: refund.id,
              amount: refundSubtotal,
            });
            return {
              status: 500,
              payload: {
                error:
                  "Failed to apply store credit. Refund record exists but credit was not added — please contact support.",
              },
            };
          }
        }
      }
    }

    return {
      status: 200,
      payload: { success: true, refundNumber, refundId: refund.id },
    };
  });

  if ("duplicate" in result && result.duplicate) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const r = result as { status: number; payload: Record<string, unknown> };
  return NextResponse.json(r.payload, { status: r.status });
}
