import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateCSRFForRequest } from "@/lib/csrf";
import { posRefundSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  // CSRF protection
  if (!validateCSRFForRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const body = await req.json();
  const parseResult = posRefundSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }
  const { tenantId, saleId, items, refundMethod, reason, notes, total } = parseResult.data;

  // Rate limit refunds per tenant to prevent fraud
  const { success: rateLimitOk } = await checkRateLimit(`pos-refund:${tenantId}`);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many refund requests. Please try again later." }, { status: 429 });
  }

  const admin = createAdminClient();

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
    return NextResponse.json({ error: refundErr.message }, { status: 500 });
  }

  // Create refund items and restore inventory
  for (const item of items as Array<{ saleItemId: string; quantity: number; unitPrice: number }>) {
    // Insert refund item
    await admin.from("refund_items").insert({
      tenant_id: tenantId,
      refund_id: refund.id,
      sale_item_id: item.saleItemId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.quantity * item.unitPrice,
    });

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
        await admin
          .from("inventory")
          .update({ quantity: (inv.quantity || 0) + item.quantity })
          .eq("id", saleItem.inventory_id);

        // Log stock movement
        await admin.from("stock_movements").insert({
          tenant_id: tenantId,
          inventory_id: saleItem.inventory_id,
          movement_type: "return",
          quantity_change: item.quantity,
          quantity_after: (inv.quantity || 0) + item.quantity,
          notes: `Refund ${refundNumber}`,
        });
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
      await admin
        .from("customers")
        .update({ store_credit: (customer.store_credit || 0) + total })
        .eq("id", sale.customer_id);
    }
  }

  return NextResponse.json({ success: true, refundNumber, refundId: refund.id });
}
