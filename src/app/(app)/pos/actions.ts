"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWithSafety } from "@/lib/transaction-safety";
import { withIdempotency, createPaymentFingerprint } from "@/lib/idempotency";

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

  // If using store credit, verify and deduct ATOMICALLY
  let storeCreditNewBalance: number | null = null;
  if (params.storeCreditAmount && params.storeCreditAmount > 0) {
    if (!params.customerId) return { error: "Customer required for store credit" };
    
    // Atomic deduction: only update if balance is sufficient
    // Using .gte filter ensures we don't go negative
    const { data: customer } = await admin
      .from("customers")
      .select("store_credit")
      .eq("id", params.customerId)
      .eq("tenant_id", params.tenantId)
      .gte("store_credit", params.storeCreditAmount)
      .single();
    
    if (!customer) {
      return { error: "Insufficient store credit balance" };
    }

    // Calculate new balance and update with conditional check
    storeCreditNewBalance = (customer.store_credit || 0) - params.storeCreditAmount;
    
    const { error: creditErr, count: creditCount } = await admin
      .from("customers")
      .update({ store_credit: storeCreditNewBalance })
      .eq("id", params.customerId)
      .eq("tenant_id", params.tenantId)
      .gte("store_credit", params.storeCreditAmount); // Double-check: only if still sufficient
    
    if (creditErr || creditCount === 0) {
      return { error: "Store credit balance changed — please try again" };
    }
  }

  // If using voucher, verify and reserve balance atomically
  let voucherOriginalBalance: number | null = null;
  if (params.voucherId && params.voucherAmount && params.voucherAmount > 0) {
    const { data: voucher } = await admin
      .from("gift_vouchers")
      .select("id, balance, status")
      .eq("id", params.voucherId)
      .eq("tenant_id", params.tenantId)
      .eq("status", "active") // Must be active
      .gte("balance", params.voucherAmount) // Must have sufficient balance
      .single();

    if (!voucher) {
      return { error: "Voucher not found, already used, or insufficient balance" };
    }
    voucherOriginalBalance = voucher.balance;
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

  // Handle voucher redemption ATOMICALLY with conditional update
  if (params.voucherId && params.voucherAmount && params.voucherAmount > 0 && voucherOriginalBalance !== null) {
    const newBalance = Math.max(0, voucherOriginalBalance - params.voucherAmount);
    const newStatus = newBalance === 0 ? "redeemed" : "active";

    // Atomic update: only if balance hasn't changed (prevents double-redemption race)
    const { error: voucherErr, count: voucherCount } = await admin
      .from("gift_vouchers")
      .update({ balance: newBalance, status: newStatus })
      .eq("id", params.voucherId)
      .eq("tenant_id", params.tenantId)
      .eq("balance", voucherOriginalBalance) // Only if balance unchanged
      .eq("status", "active"); // Only if still active

    if (voucherErr || voucherCount === 0) {
      // Voucher was used by another session — but sale already created
      // Log the issue but don't fail the sale (it's already committed)
      console.error(`[POS] Voucher race condition: ${params.voucherId} balance changed during sale ${sale.id}`);
    } else {
      // Record redemption history
      await admin.from("gift_voucher_redemptions").insert({
        voucher_id: params.voucherId,
        sale_id: sale.id,
        amount_used: params.voucherAmount,
        tenant_id: params.tenantId,
        redeemed_at: new Date().toISOString(),
      });
    }
  }

  // Record store credit history AFTER sale is created (ties to sale record)
  if (params.storeCreditAmount && params.storeCreditAmount > 0 && storeCreditNewBalance !== null) {
    await admin.from("customer_store_credit_history").insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      amount: -params.storeCreditAmount,
      balance_after: storeCreditNewBalance,
      reason: "POS Purchase",
      reference_type: "sale",
      reference_id: sale.id,
      created_by: params.userId,
    });
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

  // Deduct stock for each item with race-safe pattern and HARD FAIL on insufficient
  for (const item of params.cart) {
    // Get current quantity
    const { data: inv } = await admin
      .from("inventory")
      .select("quantity, name")
      .eq("id", item.inventoryId)
      .eq("tenant_id", params.tenantId)
      .single();

    if (inv) {
      const oldQty = inv.quantity;
      const newQty = oldQty - item.quantity;
      
      // HARD FAIL: Do not allow sale if insufficient stock
      if (newQty < 0) {
        // Sale already created — mark it as failed/voided
        await admin.from("sales").update({ status: "voided" }).eq("id", sale.id);
        return { error: `Insufficient stock for "${inv.name || item.name}". Available: ${oldQty}, Requested: ${item.quantity}` };
      }
      
      // Conditional update: only if quantity hasn't changed (prevents overselling race)
      const { count: updateCount } = await admin
        .from("inventory")
        .update({ quantity: newQty })
        .eq("id", item.inventoryId)
        .eq("tenant_id", params.tenantId)
        .eq("quantity", oldQty); // Only update if quantity unchanged
      
      // If race occurred, re-fetch and HARD FAIL if insufficient
      let finalQty = newQty;
      if (updateCount === 0) {
        const { data: invRetry } = await admin
          .from("inventory")
          .select("quantity")
          .eq("id", item.inventoryId)
          .eq("tenant_id", params.tenantId)
          .single();
        if (invRetry) {
          finalQty = invRetry.quantity - item.quantity;
          if (finalQty < 0) {
            await admin.from("sales").update({ status: "voided" }).eq("id", sale.id);
            return { error: `Item "${inv.name || item.name}" just sold out. Please remove it and try again.` };
          }
          await admin
            .from("inventory")
            .update({ quantity: finalQty })
            .eq("id", item.inventoryId)
            .eq("tenant_id", params.tenantId);
        }
      }

      // Log stock movement with accurate final quantity
      await admin.from("stock_movements").insert({
        tenant_id: params.tenantId,
        inventory_id: item.inventoryId,
        movement_type: "sale",
        quantity_change: -item.quantity,
        quantity_after: finalQty,
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

  // Store deposit amount and amount_paid
  await admin
    .from("sales")
    .update({
      deposit_amount: params.depositAmount,
      amount_paid: params.depositAmount,
    })
    .eq("id", sale.id);

  // Record initial deposit payment
  await admin.from("layby_payments").insert({
    tenant_id: params.tenantId,
    sale_id: sale.id,
    amount: params.depositAmount,
    payment_method: "cash",
    notes: "Initial deposit",
    paid_by: params.userId,
    paid_at: new Date().toISOString(),
  });

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
        inventory_id: item.inventoryId,
      }))
    );
  }

  return { id: sale.id, saleNumber };
}
