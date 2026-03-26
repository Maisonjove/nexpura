import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tenantId, saleId, items, refundMethod, reason, notes, total } = body;
  if (!tenantId || !saleId || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

  // Generate refund number
  const { count } = await admin
    .from("refunds")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const refundNumber = `R-${String((count ?? 0) + 1).padStart(4, "0")}`;

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
      customer_id: sale.customer_id || null,
      customer_name: sale.customer_name || null,
      status: "completed",
    })
    .select("id")
    .single();

  if (refundErr) {
    // If table doesn't have all columns, try simpler insert
    const { data: r2, error: e2 } = await admin
      .from("refunds")
      .insert({
        tenant_id: tenantId,
        sale_id: saleId,
        total: total,
        refund_method: refundMethod,
        reason,
        notes: notes || null,
        status: "completed",
      })
      .select("id")
      .single();
    
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    
    return NextResponse.json({ success: true, refundNumber, refundId: r2?.id });
  }

  // Create refund items
  const refundItems = items.map((item: { saleItemId: string; quantity: number; unitPrice: number }) => ({
    tenant_id: tenantId,
    refund_id: refund.id,
    sale_item_id: item.saleItemId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total: item.quantity * item.unitPrice,
  }));

  await admin.from("refund_items").insert(refundItems)

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
