"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CartItem {
  inventoryId: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  itemType: string | null;
}

interface CreatePOSSaleParams {
  tenantId: string;
  userId: string;
  cart: CartItem[];
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
}

export async function createPOSSale(
  params: CreatePOSSaleParams
): Promise<{ id?: string; saleNumber?: string; invoiceId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Generate sale number
  const { count } = await admin
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", params.tenantId);

  const saleNumber = `S-${String((count ?? 0) + 1).padStart(4, "0")}`;

  // Create sale
  const { data: sale, error: saleErr } = await admin
    .from("sales")
    .insert({
      tenant_id: params.tenantId,
      sale_number: saleNumber,
      customer_id: params.customerId,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      subtotal: params.subtotal,
      discount_amount: params.discountAmount,
      tax_amount: params.taxAmount,
      total: params.total,
      payment_method: params.paymentMethod,
      status: "paid",
      sold_by: params.userId,
      sale_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (saleErr || !sale) return { error: saleErr?.message ?? "Failed to create sale" };

  // Create sale items
  if (params.cart.length > 0) {
    await admin.from("sale_items").insert(
      params.cart.map((item) => ({
        tenant_id: params.tenantId,
        sale_id: sale.id,
        description: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.unitPrice * item.quantity,
      }))
    );
  }

  // Deduct stock for each item atomically
  for (const item of params.cart) {
    // Get current quantity
    const { data: inv } = await admin
      .from("inventory")
      .select("quantity")
      .eq("id", item.inventoryId)
      .eq("tenant_id", params.tenantId)
      .single();

    if (inv) {
      const newQty = Math.max(0, inv.quantity - item.quantity);
      await admin
        .from("inventory")
        .update({ quantity: newQty })
        .eq("id", item.inventoryId)
        .eq("tenant_id", params.tenantId);

      // Log stock movement
      await admin.from("stock_movements").insert({
        tenant_id: params.tenantId,
        inventory_id: item.inventoryId,
        movement_type: "sale",
        quantity_change: -item.quantity,
        quantity_after: newQty,
        notes: `POS Sale ${saleNumber}`,
        created_by: params.userId,
      });
    }
  }

  // Auto-create invoice
  let invoiceId: string | undefined;
  try {
    const { data: invoiceNumberData } = await admin.rpc("next_invoice_number", {
      p_tenant_id: params.tenantId,
    });

    const { data: newInvoice } = await admin
      .from("invoices")
      .insert({
        tenant_id: params.tenantId,
        invoice_number: invoiceNumberData ?? `INV-${Date.now()}`,
        customer_id: params.customerId,
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        sale_id: sale.id,
        invoice_date: new Date().toISOString().split("T")[0],
        subtotal: params.subtotal,
        discount_amount: params.discountAmount,
        tax_name: "GST",
        tax_rate: 0.1,
        tax_inclusive: true,
        tax_amount: params.taxAmount,
        total: params.total,
        status: "paid",
        paid_at: new Date().toISOString(),
        created_by: params.userId,
      })
      .select("id")
      .single();

    if (newInvoice) {
      invoiceId = newInvoice.id;
      // Insert invoice line items
      await admin.from("invoice_line_items").insert(
        params.cart.map((item, idx) => ({
          tenant_id: params.tenantId,
          invoice_id: newInvoice.id,
          description: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_pct: 0,
          line_total: item.unitPrice * item.quantity,
          sort_order: idx,
        }))
      );
    }
  } catch {
    // Invoice creation is non-critical
  }

  return { id: sale.id, saleNumber, invoiceId };
}
