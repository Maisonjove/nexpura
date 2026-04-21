import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateCSRFForRequest } from "@/lib/csrf";
import { posRefundSchema } from "@/lib/schemas";
import { reportServerError } from "@/lib/logger";

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

  const admin = createAdminClient();
  
  // SECURITY: Get user's tenant_id from database, NOT from request body
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  
  if (!userData?.tenant_id) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  const body = await req.json();
  const parseResult = posRefundSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }
  const { saleId, items, refundMethod, reason, notes, total } = parseResult.data;
  
  // SECURITY: Use authenticated tenant_id, ignore client-supplied one
  const tenantId = userData.tenant_id;

  // Rate limit refunds per tenant to prevent fraud
  const { success: rateLimitOk } = await checkRateLimit(`pos-refund:${tenantId}`);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many refund requests. Please try again later." }, { status: 429 });
  }

  // Check sale exists
  const { data: sale } = await admin
    .from("sales")
    .select("id, sale_number, total, customer_id, customer_name")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();

  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  // Generate refund number using function or fallback
  let refundNumber: string;
  const { data: numData } = await admin.rpc("next_refund_number", { p_tenant_id: tenantId });
  if (numData) {
    refundNumber = numData;
  } else {
    const { count } = await admin
      .from("refunds")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    refundNumber = `R-${String((count ?? 0) + 1).padStart(4, "0")}`;
  }

  // Create refund record
  const { data: refund, error: refundErr } = await admin
    .from("refunds")
    .insert({
      tenant_id: tenantId,
      sale_id: saleId,
      refund_number: refundNumber,
      total: total,
      refund_method: refundMethod,
      reason,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (refundErr) {
    reportServerError("pos/refund:refunds.insert", refundErr, { saleId, tenantId });
    return NextResponse.json({ error: refundErr.message }, { status: 500 });
  }

  // Create refund items and restore inventory.
  // Each mutation's error is now captured and reported — previously the
  // awaited calls discarded their { error } return so a failed refund_items
  // insert or inventory update still led to a "success" response.
  for (const item of items as Array<{ saleItemId: string; quantity: number; unitPrice: number }>) {
    // Insert refund item — this is load-bearing: without it the refund
    // record has no line items and the audit/accounting trail is broken.
    const { error: refundItemErr } = await admin.from("refund_items").insert({
      tenant_id: tenantId,
      refund_id: refund.id,
      sale_item_id: item.saleItemId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.quantity * item.unitPrice,
    });
    if (refundItemErr) {
      reportServerError("pos/refund:refund_items.insert", refundItemErr, {
        refundId: refund.id,
        saleItemId: item.saleItemId,
        tenantId,
      });
      return NextResponse.json(
        { error: "Failed to record refund item. Refund has been halted — please retry." },
        { status: 500 },
      );
    }

    // Get the original sale item to find inventory_id
    const { data: saleItem } = await admin
      .from("sale_items")
      .select("inventory_id, quantity")
      .eq("id", item.saleItemId)
      .single();

    // Restore inventory quantity
    if (saleItem?.inventory_id) {
      const { data: inv } = await admin
        .from("inventory")
        .select("quantity")
        .eq("id", saleItem.inventory_id)
        .single();

      if (inv) {
        const { error: invUpdateErr } = await admin
          .from("inventory")
          .update({ quantity: (inv.quantity || 0) + item.quantity })
          .eq("id", saleItem.inventory_id);
        if (invUpdateErr) {
          // Inventory miscount is recoverable (stock can be re-audited) so
          // we don't hard-fail the whole refund, but page Sentry loudly —
          // this quietly drifting is exactly how stock counts get broken.
          reportServerError("pos/refund:inventory.update", invUpdateErr, {
            inventoryId: saleItem.inventory_id,
            tenantId,
            refundId: refund.id,
          });
        }

        // Log stock movement
        const { error: stockMoveErr } = await admin.from("stock_movements").insert({
          tenant_id: tenantId,
          inventory_id: saleItem.inventory_id,
          movement_type: "return",
          quantity_change: item.quantity,
          quantity_after: (inv.quantity || 0) + item.quantity,
          notes: `Refund ${refundNumber}`,
        });
        if (stockMoveErr) {
          reportServerError("pos/refund:stock_movements.insert", stockMoveErr, {
            inventoryId: saleItem.inventory_id,
            tenantId,
            refundId: refund.id,
          });
        }
      }
    }
  }

  // If store credit refund, add to customer balance
  if (refundMethod === "store_credit" && sale.customer_id) {
    const { data: customer } = await admin
      .from("customers")
      .select("store_credit")
      .eq("id", sale.customer_id)
      .single();

    if (customer) {
      // Critical: if this fails, customer is owed money with no balance
      // to draw from — return 500 so the till can surface the error.
      const { error: storeCreditErr } = await admin
        .from("customers")
        .update({ store_credit: (customer.store_credit || 0) + total })
        .eq("id", sale.customer_id);
      if (storeCreditErr) {
        reportServerError("pos/refund:customers.store_credit.update", storeCreditErr, {
          customerId: sale.customer_id,
          tenantId,
          refundId: refund.id,
          amount: total,
        });
        return NextResponse.json(
          { error: "Failed to apply store credit. Refund record exists but credit was not added — please contact support." },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ success: true, refundNumber, refundId: refund.id });
}
