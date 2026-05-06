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

  // A1 dispatch (2026-05-06): when tenants.a1_money_correctness is
  // TRUE, route through the same process_refund_v2 RPC the
  // (app)/refunds/actions.ts processRefund flow uses. Single source
  // of truth for tenants on the new flow — no path drift between
  // POS and the refunds page. Falls through to the legacy in-line
  // saga below when the flag is FALSE.
  const { data: tenantFlag } = await admin
    .from("tenants")
    .select("a1_money_correctness")
    .eq("id", tenantId)
    .single();
  if (tenantFlag?.a1_money_correctness === true) {
    return await dispatchPosRefundV2({
      admin,
      tenantId,
      userId,
      saleId,
      items: items as Array<{ saleItemId: string; quantity: number; unitPrice: number; restock?: boolean; inventoryId?: string | null }>,
      refundMethod: refundMethod as string,
      reason: (reason as string | undefined) ?? "",
      notes: (notes as string | undefined) ?? null,
      gatewayRef: (parseResult.data as { gatewayRef?: string }).gatewayRef ?? null,
      managerPin: (parseResult.data as { managerPin?: string }).managerPin ?? null,
    });
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

  // Compute refund tax + total at the tenant's tax rate so the refund
  // mirrors the original sale (which adds tax on top of subtotal). The
  // pre-fix legacy route stored `total = subtotal`, which under-credited
  // the customer by the tax portion when refundMethod === "store_credit"
  // — a sale of $80 + $8 GST = $88 was refunded to $80 of credit, $8
  // short. Matches processRefund's behaviour.
  const { data: tenantData } = await admin
    .from("tenants")
    .select("tax_rate")
    .eq("id", tenantId)
    .single();
  const taxRate = Number(tenantData?.tax_rate ?? 0.1);
  const refundTaxAmount = Math.round(refundSubtotal * taxRate * 100) / 100;
  const refundTotal = refundSubtotal + refundTaxAmount;

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
  if (refundTotal > remainingRefundable + 0.01) {
    return NextResponse.json(
      {
        error:
          `Refund exceeds remaining refundable amount. Sale total ${saleTotal.toFixed(2)}, ` +
          `already refunded ${alreadyRefunded.toFixed(2)}, remaining ${remainingRefundable.toFixed(2)}, ` +
          `requested ${refundTotal.toFixed(2)}.`,
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
        tax_amount: refundTaxAmount,
        total: refundTotal,
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

    // Build refund_items + their target inventory_ids in one pass so we
    // can do a SINGLE bulk insert (succeeds-or-fails atomically). Pre-fix
    // looped one-by-one inserts: if item N failed mid-loop, items 1..N-1
    // were committed + their stock restored, but the refund row was
    // already committed too — leaving a money-out record without full
    // line detail and partial inventory restoration. That's the gap.
    const refundItemRows: Array<{
      tenant_id: string;
      refund_id: string;
      original_sale_item_id: string;
      inventory_id: string | null;
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      restock: boolean;
    }> = [];
    const stockReturnTargets: Array<{ inventoryId: string; quantity: number }> = [];

    for (const item of items2) {
      const { data: srcSaleItem } = await admin
        .from("sale_items")
        .select("inventory_id, description")
        .eq("id", item.saleItemId)
        .eq("tenant_id", tenantId)
        .single();
      const lineTotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
      refundItemRows.push({
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
      if (srcSaleItem?.inventory_id) {
        stockReturnTargets.push({
          inventoryId: srcSaleItem.inventory_id,
          quantity: item.quantity,
        });
      }
    }

    // Bulk insert refund_items — atomic from PostgREST's perspective
    // (single SQL statement). If it fails, roll back the refund row so
    // we don't leave a refund record with money flagged out and no
    // backing line items.
    const { error: refundItemErr } = await admin
      .from("refund_items")
      .insert(refundItemRows);
    if (refundItemErr) {
      reportServerError("pos/refund:refund_items.insert", refundItemErr, {
        refundId: refund.id,
        tenantId,
      });
      const { error: rollbackErr } = await admin
        .from("refunds")
        .delete()
        .eq("id", refund.id)
        .eq("tenant_id", tenantId);
      if (rollbackErr) {
        reportServerError("pos/refund:refund_rollback_failed", rollbackErr, {
          refundId: refund.id,
          tenantId,
        });
      }
      return {
        status: 500,
        payload: {
          error: "Failed to record refund items — refund rolled back. Please retry.",
        },
      };
    }

    // Bulk insert stock_movements. The sync_inventory_quantity trigger
    // applies quantity_change to the inventory row + sets quantity_after
    // — so the route does NOT touch inventory directly. Same pattern as
    // inventory create-item (commit 00d9e91) + pos_deduct_stock (commit
    // 2b0850b): direct updates compete with the trigger and double-apply.
    //
    // If stock_movements fails after refund_items succeeded, the audit
    // trail of the refund stays intact — but inventory is short. Log
    // loudly so ops can reconcile manually; do NOT roll back the refund
    // (the customer's money is already accounted for).
    if (stockReturnTargets.length > 0) {
      const { error: stockMoveErr } = await admin
        .from("stock_movements")
        .insert(
          stockReturnTargets.map((t) => ({
            tenant_id: tenantId,
            inventory_id: t.inventoryId,
            movement_type: "return",
            quantity_change: t.quantity,
            notes: `Refund ${refundNumber}`,
            created_by: userId,
          })),
        );
      if (stockMoveErr) {
        reportServerError("pos/refund:stock_movements.insert", stockMoveErr, {
          tenantId,
          refundId: refund.id,
          targetCount: stockReturnTargets.length,
        });
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
        const newBalance = oldBalance + refundTotal;

        // PostgREST `.update()` returns count=null unless head/exact is
        // requested via `{ count: "exact" }`. Without it, `creditCount`
        // is undefined and the `=== 0` check below never triggers — a
        // stale CAS (e.g. concurrent POS sale changed store_credit
        // between the SELECT and UPDATE) goes undetected, the row
        // doesn't actually update, and the customer is shorted the
        // refund credit. Same fix applied to all CAS sites in this
        // session.
        const { error: creditErr, count: creditCount } = await admin
          .from("customers")
          .update({ store_credit: newBalance }, { count: "exact" })
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
          const retryNew = (customerRetry?.store_credit || 0) + refundTotal;
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
              amount: refundTotal,
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

// ──────────────────────────────────────────────────────────────────
// A1 Day 2 — process_refund_v2 dispatch for the POS path.
// ──────────────────────────────────────────────────────────────────

/** 30-day window matches the sibling `processRefundV2` in
 *  src/app/(app)/refunds/actions.ts. Beyond this from the sale's
 *  created_at, refund requires a manager PIN. */
const POS_REFUND_PIN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface DispatchPosRefundV2Args {
  admin: ReturnType<typeof createAdminClient>;
  tenantId: string;
  userId: string;
  saleId: string;
  items: Array<{
    saleItemId: string;
    quantity: number;
    unitPrice: number;
    restock?: boolean;
    inventoryId?: string | null;
  }>;
  refundMethod: string;
  reason: string;
  notes: string | null;
  gatewayRef: string | null;
  managerPin: string | null;
}

async function dispatchPosRefundV2(p: DispatchPosRefundV2Args): Promise<NextResponse> {
  // Sale exists check + window/PIN gate. Mirrors the sibling
  // processRefundV2 in (app)/refunds/actions.ts. Both wrappers
  // delegate the data-tier invariants to the RPC; their only job is
  // RBAC + PIN + idempotency-key composition.
  const { data: sale } = await p.admin
    .from("sales")
    .select("id, created_at, customer_id, customer_name, customer_email")
    .eq("id", p.saleId)
    .eq("tenant_id", p.tenantId)
    .maybeSingle();
  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const saleAgeMs = Date.now() - new Date(sale.created_at).getTime();
  const requiresPin = saleAgeMs > POS_REFUND_PIN_WINDOW_MS;
  if (requiresPin) {
    if (!p.managerPin) {
      return NextResponse.json(
        {
          error:
            "This sale is older than 30 days. A manager PIN is required to refund it.",
        },
        { status: 403 },
      );
    }
    const { data: member } = await p.admin
      .from("team_members")
      .select("manager_pin_hash")
      .eq("user_id", p.userId)
      .eq("tenant_id", p.tenantId)
      .maybeSingle();
    if (!member?.manager_pin_hash) {
      return NextResponse.json(
        {
          error:
            "Manager PIN required, but you haven't set one yet. Set it in Settings → Profile and retry.",
        },
        { status: 403 },
      );
    }
    const { verifyManagerPin } = await import("@/lib/manager-pin");
    const ok = await verifyManagerPin(p.managerPin, member.manager_pin_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "Manager PIN incorrect." },
        { status: 403 },
      );
    }
  }

  // Idempotency-key fingerprint. Same shape as the legacy POS path's
  // `createPaymentFingerprint(...)` so flag-flip mid-flow doesn't
  // duplicate.
  const itemFingerprint = p.items
    .map((i) => `${i.saleItemId}:${i.quantity}:${i.unitPrice}`)
    .sort()
    .join(",");
  const idempotencyKey = `${p.saleId}:${p.refundMethod}:${itemFingerprint}`;

  const refundType =
    p.refundMethod === "store_credit" ? "store_credit" : "full";

  // Map POS items → JSONB shape the RPC expects. POS uses
  // `saleItemId` whereas the refunds page uses `original_sale_item_id`
  // — re-map here so the RPC sees a single canonical shape.
  const itemsJsonb = p.items.map((i) => ({
    original_sale_item_id: i.saleItemId,
    inventory_id: i.inventoryId ?? null,
    description: "",
    quantity: i.quantity,
    unit_price: i.unitPrice,
    restock: i.restock ?? false,
  }));

  const { data, error } = await p.admin.rpc("process_refund_v2", {
    p_tenant_id: p.tenantId,
    p_user_id: p.userId,
    p_original_sale_id: p.saleId,
    p_reason: p.reason,
    p_refund_method: p.refundMethod,
    p_refund_type: refundType,
    p_items: itemsJsonb,
    p_notes: p.notes,
    p_gateway_ref: p.gatewayRef,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    reportServerError("pos/refund:rpc.process_refund_v2", error, {
      tenantId: p.tenantId,
      saleId: p.saleId,
    });
    if (error.code === "23514") {
      return NextResponse.json(
        { error: "Refund exceeds remaining refundable amount." },
        { status: 400 },
      );
    }
    if (error.code === "P0002") {
      return NextResponse.json(
        { error: "Original sale not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: error.message ?? "Refund failed. Please retry." },
      { status: 500 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.refund_id) {
    return NextResponse.json(
      { error: "Refund failed: no row returned by RPC." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      refundId: row.refund_id,
      refundNumber: row.refund_number,
      glEntryId: row.gl_entry_id,
      flowVersion: "v2",
    },
    { status: 200 },
  );
}
