"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWithSafety, TransactionStep } from "@/lib/transaction-safety";
import logger from "@/lib/logger";
import { revalidateTag } from "next/cache";
import { getSelectedLocationIdFromCookie, hasLocationAccess } from "@/lib/locations";
import { assertTenantActive } from "@/lib/assert-tenant-active";

// POSWrapper already gates the UI on a specific location being chosen (see
// the "Select a Location" guard), so every POS sale has the picker cookie
// set. Stamp the resolved id onto both the sale and its auto-generated
// invoice so the dashboard's per-location numbers stay consistent with
// what was actually sold where.
async function resolvePOSLocationId(tenantId: string, userId: string): Promise<string | null> {
  const cookieLoc = await getSelectedLocationIdFromCookie();
  if (!cookieLoc) return null;
  const allowed = await hasLocationAccess(userId, tenantId, cookieLoc);
  return allowed ? cookieLoc : null;
}

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
  idempotencyKey?: string; // Prevents duplicate submissions
}

export async function createPOSSale(
  params: CreatePOSSaleParams
): Promise<{ id?: string; saleNumber?: string; invoiceId?: string; error?: string; auditId?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Paywall: block sales for suspended tenants at the server action level.
    // UI gating alone is not sufficient (a suspended tenant with a valid
    // session can POST directly). See src/lib/assert-tenant-active.ts.
    try {
      await assertTenantActive(params.tenantId);
    } catch {
      return { error: "Your subscription is inactive. Please update billing to continue." };
    }

    const admin = createAdminClient();

    // Idempotency check - prevent duplicate submissions
    if (params.idempotencyKey) {
      const { data: existing } = await admin
        .from("sales")
        .select("id, sale_number")
        .eq("tenant_id", params.tenantId)
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle();
      
      if (existing) {
        // Return the existing sale instead of creating a duplicate
        logger.info("Duplicate POS submission prevented", { 
          idempotencyKey: params.idempotencyKey, 
          existingSaleId: existing.id 
        });
        return { 
          id: existing.id, 
          saleNumber: existing.sale_number,
          error: undefined 
        };
      }
    }
  
  // Generate sale number using atomic RPC (returns format like "SALE-0001")
  // This ensures no duplicate numbers and consistent formatting
  const { data: saleNumber, error: saleNumErr } = await admin.rpc("next_sale_number", { 
    p_tenant_id: params.tenantId 
  });
  if (saleNumErr || !saleNumber) {
    return { error: `Failed to generate sale number: ${saleNumErr?.message ?? "Unknown error"}` };
  }
  
  // Track state for rollback
  let saleId: string | null = null;
  let storeCreditDeducted = false;
  let storeCreditOriginal: number | null = null;
  let voucherDeducted = false;
  let voucherOriginalBalance: number | null = null;
  let invoiceId: string | undefined;
  const stockDeductions: { inventoryId: string; quantity: number; originalQty: number }[] = [];

  // Define transaction steps
  const steps: TransactionStep[] = [
    // Step 1: Deduct store credit if used
    {
      name: "deduct_store_credit",
      execute: async () => {
        if (!params.storeCreditAmount || params.storeCreditAmount <= 0) {
          return { success: true, data: { skipped: true } };
        }
        if (!params.customerId) {
          return { success: false, error: "Customer required for store credit" };
        }
        
        const { data: customer } = await admin
          .from("customers")
          .select("store_credit")
          .eq("id", params.customerId)
          .eq("tenant_id", params.tenantId)
          .gte("store_credit", params.storeCreditAmount)
          .single();
        
        if (!customer) {
          return { success: false, error: "Insufficient store credit balance" };
        }
        
        const currentBalance = customer.store_credit || 0;
        storeCreditOriginal = currentBalance;
        const newBalance = currentBalance - (params.storeCreditAmount || 0);
        
        const { error, count: updateCount } = await admin
          .from("customers")
          .update({ store_credit: newBalance })
          .eq("id", params.customerId)
          .eq("tenant_id", params.tenantId)
          .eq("store_credit", currentBalance);
        
        if (error || updateCount === 0) {
          return { success: false, error: "Store credit balance changed — please try again" };
        }
        
        storeCreditDeducted = true;
        return { success: true, data: { newBalance } };
      },
      compensate: async () => {
        if (storeCreditDeducted && params.customerId && storeCreditOriginal !== null) {
          await admin
            .from("customers")
            .update({ store_credit: storeCreditOriginal })
            .eq("id", params.customerId)
            .eq("tenant_id", params.tenantId);
        }
      },
    },
    
    // Step 2: Deduct voucher if used
    {
      name: "deduct_voucher",
      execute: async () => {
        if (!params.voucherId || !params.voucherAmount || params.voucherAmount <= 0) {
          return { success: true, data: { skipped: true } };
        }
        
        const { data: voucher } = await admin
          .from("gift_vouchers")
          .select("id, balance, status")
          .eq("id", params.voucherId)
          .eq("tenant_id", params.tenantId)
          .eq("status", "active")
          .gte("balance", params.voucherAmount)
          .single();
        
        if (!voucher) {
          return { success: false, error: "Voucher not found, already used, or insufficient balance" };
        }
        
        const currentBalance = voucher.balance || 0;
        voucherOriginalBalance = currentBalance;
        const newBalance = Math.max(0, currentBalance - (params.voucherAmount || 0));
        const newStatus = newBalance === 0 ? "redeemed" : "active";
        
        const { error, count: updateCount } = await admin
          .from("gift_vouchers")
          .update({ balance: newBalance, status: newStatus })
          .eq("id", params.voucherId)
          .eq("tenant_id", params.tenantId)
          .eq("balance", currentBalance)
          .eq("status", "active");
        
        if (error || updateCount === 0) {
          return { success: false, error: "Voucher was used by another transaction" };
        }
        
        voucherDeducted = true;
        return { success: true, data: { newBalance } };
      },
      compensate: async () => {
        if (voucherDeducted && params.voucherId && voucherOriginalBalance !== null) {
          await admin
            .from("gift_vouchers")
            .update({ balance: voucherOriginalBalance, status: "active" })
            .eq("id", params.voucherId)
            .eq("tenant_id", params.tenantId);
        }
      },
    },
    
    // Step 3: Create sale record
    {
      name: "create_sale",
      execute: async () => {
        const posLocationId = await resolvePOSLocationId(params.tenantId, params.userId);
        const { data: sale, error } = await admin
          .from("sales")
          .insert({
            tenant_id: params.tenantId,
            location_id: posLocationId,
            sale_number: saleNumber,
            customer_id: params.customerId,
            customer_name: params.customerName,
            customer_email: params.customerEmail,
            subtotal: params.subtotal,
            discount_amount: params.discountAmount,
            tax_amount: params.taxAmount,
            total: params.total,
            amount_paid: params.total,
            payment_method: params.paymentMethod,
            store_credit_amount: params.storeCreditAmount || 0,
            status: "paid",
            sold_by: params.userId,
            sale_date: new Date().toISOString().split("T")[0],
          })
          .select("id")
          .single();
        
        if (error || !sale) {
          return { success: false, error: error?.message ?? "Failed to create sale" };
        }
        
        saleId = sale.id;
        return { success: true, data: { saleId: sale.id } };
      },
      compensate: async () => {
        if (saleId) {
          await admin.from("sales").update({ status: "voided" }).eq("id", saleId);
        }
      },
    },
    
    // Step 4: Create sale items
    {
      name: "create_sale_items",
      execute: async () => {
        if (!saleId || params.cart.length === 0) {
          return { success: true, data: { skipped: true } };
        }
        
        const { error } = await admin.from("sale_items").insert(
          params.cart.map((item) => ({
            tenant_id: params.tenantId,
            sale_id: saleId,
            inventory_id: item.inventoryId,
            description: item.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            line_total: item.unitPrice * item.quantity,
          }))
        );
        
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      },
    },
    
    // Step 5: Deduct stock for each item
    {
      name: "deduct_stock",
      execute: async () => {
        for (const item of params.cart) {
          const { data: inv } = await admin
            .from("inventory")
            .select("quantity, name")
            .eq("id", item.inventoryId)
            .eq("tenant_id", params.tenantId)
            .single();
          
          if (!inv) continue;
          
          const oldQty = inv.quantity;
          const newQty = oldQty - item.quantity;
          
          if (newQty < 0) {
            return { 
              success: false, 
              error: `Insufficient stock for "${inv.name || item.name}". Available: ${oldQty}, Requested: ${item.quantity}` 
            };
          }
          
          const { count: updateCount } = await admin
            .from("inventory")
            .update({ quantity: newQty })
            .eq("id", item.inventoryId)
            .eq("tenant_id", params.tenantId)
            .eq("quantity", oldQty);
          
          if (updateCount === 0) {
            // Race occurred — another user bought the same item simultaneously
            const { data: invRetry } = await admin
              .from("inventory")
              .select("quantity, name")
              .eq("id", item.inventoryId)
              .eq("tenant_id", params.tenantId)
              .single();
            
            if (invRetry) {
              const retryQty = invRetry.quantity - item.quantity;
              if (retryQty < 0) {
                const available = invRetry.quantity;
                const itemName = invRetry.name || inv.name || item.name;
                return { 
                  success: false, 
                  error: available === 0 
                    ? `"${itemName}" just sold out while you were checking out. Please remove it from your cart.`
                    : `Only ${available} "${itemName}" left in stock (another sale just went through). Please update your cart.`
                };
              }
              await admin
                .from("inventory")
                .update({ quantity: retryQty })
                .eq("id", item.inventoryId)
                .eq("tenant_id", params.tenantId);
              stockDeductions.push({ inventoryId: item.inventoryId, quantity: item.quantity, originalQty: invRetry.quantity });
            }
          } else {
            stockDeductions.push({ inventoryId: item.inventoryId, quantity: item.quantity, originalQty: oldQty });
          }
          
          // Log stock movement
          await admin.from("stock_movements").insert({
            tenant_id: params.tenantId,
            inventory_id: item.inventoryId,
            movement_type: "sale",
            quantity_change: -item.quantity,
            quantity_after: newQty >= 0 ? newQty : 0,
            notes: `POS Sale ${saleNumber}`,
            created_by: params.userId,
          });
        }
        
        return { success: true };
      },
      compensate: async () => {
        // Restore stock for all deducted items
        for (const deduction of stockDeductions) {
          await admin
            .from("inventory")
            .update({ quantity: deduction.originalQty })
            .eq("id", deduction.inventoryId)
            .eq("tenant_id", params.tenantId);
        }
      },
    },
    
    // Step 6: Create invoice (optional, non-critical)
    {
      name: "create_invoice",
      execute: async () => {
        if (!saleId) return { success: true, data: { skipped: true } };
        
        try {
          const { data: invoiceNumberData } = await admin.rpc("next_invoice_number", {
            p_tenant_id: params.tenantId,
          });

          const posLocationIdInv = await resolvePOSLocationId(params.tenantId, params.userId);
          // Full payload — includes sale_id linkage. On schemas where the
          // sale_id column hasn't been added yet (older tenants), PostgREST
          // rejects with "column not found", so we retry without that one
          // optional field. The sale still completes, the invoice still
          // lands, and the link gets restored on the next visit once the
          // accompanying migration lands.
          const basePayload: Record<string, unknown> = {
            tenant_id: params.tenantId,
            location_id: posLocationIdInv,
            invoice_number: invoiceNumberData ?? `INV-${Date.now()}`,
            customer_id: params.customerId,
            customer_name: params.customerName,
            customer_email: params.customerEmail,
            invoice_date: new Date().toISOString().split("T")[0],
            subtotal: params.subtotal,
            discount_amount: params.discountAmount,
            tax_name: params.taxName || "GST",
            tax_rate: params.taxRate ?? 0.1,
            tax_inclusive: true,
            tax_amount: params.taxAmount,
            total: params.total,
            amount_paid: params.total,
            status: "paid",
            paid_at: new Date().toISOString(),
            created_by: params.userId,
          };
          let ins = await admin.from("invoices").insert({ ...basePayload, sale_id: saleId }).select("id").single();
          if (ins.error && /sale_id|schema cache/i.test(ins.error.message)) {
            // Retry without sale_id so POS invoice creation doesn't silently
            // disappear on schemas missing the column.
            ins = await admin.from("invoices").insert(basePayload).select("id").single();
          }
          const newInvoice = ins.data;

          if (newInvoice) {
            invoiceId = newInvoice.id;
            await admin.from("invoice_line_items").insert(
              params.cart.map((item, idx) => ({
                tenant_id: params.tenantId,
                invoice_id: newInvoice.id,
                description: item.name,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                discount_pct: 0,
                sort_order: idx,
              }))
            );
          } else if (ins.error) {
            logger.warn("POS invoice insert failed", { err: ins.error.message });
          }
        } catch (err) {
          logger.warn("POS invoice creation threw", { err: (err as Error).message });
        }
        
        return { success: true, data: { invoiceId } };
      },
    },
    
    // Step 7: Record store credit history
    {
      name: "record_credit_history",
      execute: async () => {
        if (!storeCreditDeducted || !params.customerId || !saleId) {
          return { success: true, data: { skipped: true } };
        }
        
        const newBalance = (storeCreditOriginal || 0) - (params.storeCreditAmount || 0);
        await admin.from("customer_store_credit_history").insert({
          tenant_id: params.tenantId,
          customer_id: params.customerId,
          amount: -(params.storeCreditAmount || 0),
          balance_after: newBalance,
          reason: "POS Purchase",
          reference_type: "sale",
          reference_id: saleId,
          created_by: params.userId,
        });
        
        return { success: true };
      },
    },
    
    // Step 8: Record voucher redemption history
    {
      name: "record_voucher_history",
      execute: async () => {
        if (!voucherDeducted || !params.voucherId || !saleId) {
          return { success: true, data: { skipped: true } };
        }
        
        await admin.from("gift_voucher_redemptions").insert({
          voucher_id: params.voucherId,
          sale_id: saleId,
          amount_used: params.voucherAmount,
          tenant_id: params.tenantId,
          redeemed_at: new Date().toISOString(),
        });
        
        return { success: true };
      },
    },
  ];

  // Execute with safety wrapper
  const result = await executeWithSafety(
    admin,
    "pos_sale",
    saleNumber,
    params.tenantId,
    params.userId,
    steps
  );

  if (!result.success) {
      return { error: result.error || `Failed at step: ${result.failedStep}`, auditId: result.auditId };
    }

    // Invalidate dashboard cache
    revalidateTag("dashboard", "default");
    return { id: saleId!, saleNumber, invoiceId, auditId: result.auditId };
  } catch (err) {
    logger.error("[createPOSSale] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create sale" };
  }
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
  try {
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
  const laybyLocationId = await resolvePOSLocationId(params.tenantId, params.userId);
  const { data: sale, error: saleErr } = await admin
    .from("sales")
    .insert({
      tenant_id: params.tenantId,
      location_id: laybyLocationId,
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
      deposit_amount: params.depositAmount,
      amount_paid: params.depositAmount,
    })
    .select("id")
    .single();

  if (saleErr || !sale) return { error: saleErr?.message ?? "Failed to create layby" };

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

    // Invalidate dashboard cache
    revalidateTag("dashboard", "default");
    return { id: sale.id, saleNumber };
  } catch (err) {
    logger.error("[createLaybySale] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create layby sale" };
  }
}
