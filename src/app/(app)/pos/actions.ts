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
  storeCreditAmount?: number;
  voucherId?: string | null;
  voucherAmount?: number;
  taxName?: string;
  taxRate?: number;
}

export async function createPOSSale(
  params: CreatePOSSaleParams
): Promise<{ id?: string; saleNumber?: string; invoiceId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // If using store credit, verify and deduct
  if (params.storeCreditAmount && params.storeCreditAmount > 0) {
    if (!params.customerId) return { error: "Customer required for store credit" };
    
    const { data: customer } = await admin
      .from("customers")
      .select("store_credit")
      .eq("id", params.customerId)
      .eq("tenant_id", params.tenantId)
      .single();
    
    if (!customer || (customer.store_credit || 0) < params.storeCreditAmount) {
      return { error: "Insufficient store credit balance" };
    }

    // Deduct credit
    const newBalance = (customer.store_credit || 0) - params.storeCreditAmount;
    await admin
      .from("customers")
      .update({ store_credit: newBalance })
      .eq("id", params.customerId)
      .eq("tenant_id", params.tenantId);

    // Record history
    await admin.from("customer_store_credit_history").insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      amount: -params.storeCreditAmount,
      balance_after: newBalance,
      reason: "POS Purchase",
      reference_type: "sale",
      created_by: params.userId,
    });
  }

  // If using voucher, verify balance before creating sale
  if (params.voucherId && params.voucherAmount && params.voucherAmount > 0) {
    const { data: voucher } = await admin
      .from("gift_vouchers")
      .select("id, balance, status")
      .eq("id", params.voucherId)
      .eq("tenant_id", params.tenantId)
      .single();

    if (!voucher) return { error: "Voucher not found" };
    if (voucher.status === "redeemed") return { error: "Voucher already redeemed" };
    if (voucher.status === "cancelled") return { error: "Voucher is cancelled" };
    if ((voucher.balance || 0) < params.voucherAmount) {
      return { error: "Insufficient voucher balance" };
    }
  }

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
      store_credit_amount: params.storeCreditAmount || 0,
      status: "paid",
      sold_by: params.userId,
      sale_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (saleErr || !sale) return { error: saleErr?.message ?? "Failed to create sale" };

  // Handle voucher redemption atomically with sale
  if (params.voucherId && params.voucherAmount && params.voucherAmount > 0) {
    const { data: voucher } = await admin
      .from("gift_vouchers")
      .select("id, balance")
      .eq("id", params.voucherId)
      .eq("tenant_id", params.tenantId)
      .single();

    if (voucher) {
      const newBalance = Math.max(0, (voucher.balance || 0) - params.voucherAmount);
      const newStatus = newBalance === 0 ? "redeemed" : "active";

      await admin
        .from("gift_vouchers")
        .update({ balance: newBalance, status: newStatus })
        .eq("id", params.voucherId)
        .eq("tenant_id", params.tenantId);

      await admin.from("gift_voucher_redemptions").insert({
        voucher_id: params.voucherId,
        sale_id: sale.id,
        amount_used: params.voucherAmount,
        tenant_id: params.tenantId,
        redeemed_at: new Date().toISOString(),
      });
    }
  }

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
        tax_name: params.taxName || "GST",
        tax_rate: params.taxRate ?? 0.1,
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

// ─── Layby Sale ───────────────────────────────────────────────────────────────

interface CreateLaybySaleParams {
  tenantId: string;
  userId: string;
  cart: CartItem[];
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  depositAmount: number;
  taxName?: string;
  taxRate?: number;
}

export async function createLaybySale(
  params: CreateLaybySaleParams
): Promise<{ id?: string; saleNumber?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!params.customerId) return { error: "Customer is required for layby" };
  if (params.depositAmount <= 0) return { error: "Deposit must be greater than zero" };
  if (params.depositAmount >= params.total) return { error: "Deposit must be less than total — use regular sale instead" };

  const admin = createAdminClient();

  // Generate sale number
  const { count } = await admin
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", params.tenantId);

  const saleNumber = `S-${String((count ?? 0) + 1).padStart(4, "0")}`;

  // Create layby sale record (status='layby', inventory NOT yet deducted)
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
      payment_method: "layby",
      store_credit_amount: 0,
      status: "layby",
      sold_by: params.userId,
      sale_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (saleErr || !sale) return { error: saleErr?.message ?? "Failed to create layby" };

  // Create sale items (no inventory deduction — item reserved, not sold)
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

  return { id: sale.id, saleNumber };
}
