"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { executeWithSafety, TransactionStep } from "@/lib/transaction-safety";
import logger from "@/lib/logger";
import { revalidateTag } from "next/cache";
import { getSelectedLocationIdFromCookie, hasLocationAccess } from "@/lib/locations";
import { assertTenantActive } from "@/lib/assert-tenant-active";
import { getAuthContext } from "@/lib/auth-context";
import { getTenantTaxConfig, computeMoneyTotals, clampDiscount } from "@/lib/tenant-tax";

import { flushSentry } from "@/lib/sentry-flush";
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
    // SECURITY: Session-derive tenant + user. Never trust client-supplied
    // tenantId / userId — previously (W3-CRIT-02) this action accepted both
    // from the request body, allowing a user in tenant A to create sales in
    // tenant B.
    const ctx = await getAuthContext();
    if (!ctx) return { error: "Not authenticated" };
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;

    // Paywall: block sales for suspended tenants at the server action level.
    // UI gating alone is not sufficient (a suspended tenant with a valid
    // session can POST directly). See src/lib/assert-tenant-active.ts.
    try {
      await assertTenantActive(tenantId);
    } catch {
      return { error: "Your subscription is inactive. Please update billing to continue." };
    }

    const admin = createAdminClient();

    // Idempotency check - prevent duplicate submissions
    if (params.idempotencyKey) {
      const { data: existing } = await admin
        .from("sales")
        .select("id, sale_number")
        .eq("tenant_id", tenantId)
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

  // ─── W3-CRIT-04: server-authoritative money recompute ──────────────────
  // Previously this action read subtotal / discount_amount / tax_amount /
  // total straight from the client body and stored them. A compromised or
  // buggy client could record a $5 sale for a $5000 item — classic till
  // shortfall. Now: sum the cart on the server, pull tenant tax config
  // from the DB, recompute totals, and reject if the client's claimed
  // total diverges by more than a cent.
  //
  // Tax semantics: the POS UI today always computes tax on top (exclusive)
  // regardless of the tenant's tax_inclusive flag. We mirror that here
  // (tax_inclusive=false) so an honest client still passes the match
  // check. Tenant's tax_rate is still the source of truth — a malicious
  // client cannot get a discounted tax rate through the params.
  const taxCfg = await getTenantTaxConfig(tenantId);
  const serverDiscount = clampDiscount(
    params.discountAmount,
    params.cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
  );
  const serverTotals = computeMoneyTotals(
    params.cart.map((c) => ({ quantity: c.quantity, unit_price: c.unitPrice })),
    taxCfg.tax_rate,
    false, // POS UI formula is always tax-on-top; see note above
    serverDiscount
  );
  if (Math.abs(serverTotals.total - params.total) > 0.01) {
    logger.warn("[createPOSSale] client total mismatch — rejecting", {
      tenantId,
      clientTotal: params.total,
      serverTotal: serverTotals.total,
      clientSubtotal: params.subtotal,
      serverSubtotal: serverTotals.subtotal,
    });
    return {
      error: `Client total mismatch. Expected $${serverTotals.total.toFixed(2)}, got $${params.total.toFixed(2)}.`,
    };
  }

  // Generate sale number using atomic RPC (returns format like "SALE-0001")
  // This ensures no duplicate numbers and consistent formatting
  const { data: saleNumber, error: saleNumErr } = await admin.rpc("next_sale_number", { 
    p_tenant_id: tenantId 
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
    // Step 1: Deduct store credit if used. DB-side atomic function —
    // SELECT FOR UPDATE + decrement in a single transaction. Replaces
    // the prior optimistic compare-and-swap which could race under
    // concurrent till usage and leave balance negative. See migration
    // 20260421_atomic_store_credit_voucher.sql.
    {
      name: "deduct_store_credit",
      execute: async () => {
        if (!params.storeCreditAmount || params.storeCreditAmount <= 0) {
          return { success: true, data: { skipped: true } };
        }
        if (!params.customerId) {
          return { success: false, error: "Customer required for store credit" };
        }
        // Capture the original balance BEFORE the RPC so compensate can
        // restore it if a later step fails.
        const { data: pre } = await admin
          .from("customers")
          .select("store_credit")
          .eq("id", params.customerId)
          .eq("tenant_id", tenantId)
          .single();
        storeCreditOriginal = pre?.store_credit ?? 0;

        const { data: newBalance, error } = await admin.rpc("deduct_store_credit", {
          p_customer_id: params.customerId,
          p_tenant_id: tenantId,
          p_amount: params.storeCreditAmount,
        });
        if (error) {
          if (error.message.includes("insufficient_store_credit")) {
            return { success: false, error: "Insufficient store credit balance" };
          }
          if (error.message.includes("customer_not_found")) {
            return { success: false, error: "Customer not found" };
          }
          return { success: false, error: error.message };
        }
        storeCreditDeducted = true;
        return { success: true, data: { newBalance } };
      },
      compensate: async () => {
        if (storeCreditDeducted && params.customerId && storeCreditOriginal !== null) {
          // Compensating rollback path. Caller is already handling
          // a primary error; if rollback itself fails, log loudly
          // but don't throw — that would mask the original failure
          // and surface the rollback error instead. Operator can
          // reconcile from the audit log.
          const { error: rollbackErr } = await admin
            .from("customers")
            .update({ store_credit: storeCreditOriginal })
            .eq("id", params.customerId)
            .eq("tenant_id", tenantId);
          if (rollbackErr) {
            logger.error("[pos/checkout] store-credit rollback failed", { customerId: params.customerId, err: rollbackErr });
          }
        }
      },
    },

    // Step 2: Deduct voucher if used. Same DB-side atomic pattern.
    // Prevents double-redemption races between concurrent POS terminals.
    {
      name: "deduct_voucher",
      execute: async () => {
        if (!params.voucherId || !params.voucherAmount || params.voucherAmount <= 0) {
          return { success: true, data: { skipped: true } };
        }
        const { data: pre } = await admin
          .from("gift_vouchers")
          .select("balance, status")
          .eq("id", params.voucherId)
          .eq("tenant_id", tenantId)
          .single();
        voucherOriginalBalance = pre?.balance ?? 0;

        const { error } = await admin.rpc("redeem_voucher", {
          p_voucher_id: params.voucherId,
          p_tenant_id: tenantId,
          p_amount: params.voucherAmount,
        });
        if (error) {
          if (error.message.includes("voucher_not_active")) {
            return { success: false, error: "Voucher is not active" };
          }
          if (error.message.includes("insufficient_voucher_balance")) {
            return { success: false, error: "Voucher balance is insufficient" };
          }
          if (error.message.includes("voucher_not_found")) {
            return { success: false, error: "Voucher not found" };
          }
          return { success: false, error: error.message };
        }
        voucherDeducted = true;
        return { success: true, data: {} };
      },
      compensate: async () => {
        if (voucherDeducted && params.voucherId && voucherOriginalBalance !== null) {
          // Compensating rollback — same policy as store-credit
          // rollback above. Log on error; don't throw.
          const { error: rollbackErr } = await admin
            .from("gift_vouchers")
            .update({ balance: voucherOriginalBalance, status: "active" })
            .eq("id", params.voucherId)
            .eq("tenant_id", tenantId);
          if (rollbackErr) {
            logger.error("[pos/checkout] voucher rollback failed", { voucherId: params.voucherId, err: rollbackErr });
          }
        }
      },
    },
    
    // Step 3: Create sale record
    {
      name: "create_sale",
      execute: async () => {
        const posLocationId = await resolvePOSLocationId(tenantId, userId);
        const { data: sale, error } = await admin
          .from("sales")
          .insert({
            tenant_id: tenantId,
            location_id: posLocationId,
            sale_number: saleNumber,
            customer_id: params.customerId,
            customer_name: params.customerName,
            customer_email: params.customerEmail,
            // W3-CRIT-04: store server-recomputed money, never params.*
            subtotal: serverTotals.subtotal,
            discount_amount: serverDiscount,
            tax_amount: serverTotals.taxAmount,
            total: serverTotals.total,
            amount_paid: serverTotals.total,
            payment_method: params.paymentMethod,
            store_credit_amount: params.storeCreditAmount || 0,
            status: "paid",
            sold_by: userId,
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
          // Compensating void — same rollback-policy as above.
          const { error: voidErr } = await admin
            .from("sales")
            .update({ status: "voided" })
            .eq("id", saleId);
          if (voidErr) {
            logger.error("[pos/checkout] sale void rollback failed", { saleId, err: voidErr });
          }
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
          params.cart.map((item, idx) => ({
            tenant_id: tenantId,
            sale_id: saleId,
            inventory_id: item.inventoryId,
            description: item.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            // W3-CRIT-04: server-authoritative line_total, not client-supplied
            line_total: serverTotals.lineTotals[idx],
          }))
        );
        
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      },
    },
    
    // Step 5: Deduct stock + log stock_movements in a single atomic RPC.
    // Replaces the 3–4 queries-per-item loop (SELECT, CAS UPDATE, retry,
    // INSERT stock_movement) with one Postgres round-trip that does
    // FOR UPDATE row-locks, decrements, inserts, and either succeeds
    // whole-cart or rolls back whole-cart (no partial deductions).
    // See migration 20260424_pos_deduct_stock_rpc.sql.
    //
    // If the migration hasn't landed yet (function missing / 42883) we
    // transparently fall back to the original per-item JS loop so POS
    // keeps working during the rollout seam.
    {
      name: "deduct_stock",
      execute: async () => {
        if (params.cart.length === 0) {
          return { success: true, data: { skipped: true } };
        }

        const { data: rows, error } = await admin.rpc("pos_deduct_stock", {
          p_tenant_id: tenantId,
          p_items: params.cart.map((c) => ({
            inventory_id: c.inventoryId,
            quantity: c.quantity,
            name: c.name,
          })),
          p_sale_number: saleNumber,
          p_user_id: userId,
        });

        // Migration seam: function doesn't exist yet. Fall through to
        // the legacy per-item loop below. Clear when Supabase's
        // PostgREST reports 42883 or says "Could not find the function".
        const isFnMissing =
          error &&
          (error.code === "42883" ||
            /function.*does not exist|Could not find the function/i.test(error.message));

        if (error && !isFnMissing) {
          const m = /insufficient_stock\|(.+)\|(\-?\d+)$/.exec(error.message);
          if (m) {
            const itemName = m[1];
            const available = Number(m[2]);
            return {
              success: false,
              error:
                available === 0
                  ? `"${itemName}" just sold out while you were checking out. Please remove it from your cart.`
                  : `Only ${available} "${itemName}" left in stock (another sale just went through). Please update your cart.`,
            };
          }
          return { success: false, error: error.message };
        }

        if (!error) {
          type StockRow = { inventory_id: string; original_qty: number; new_qty: number };
          for (const row of (rows ?? []) as StockRow[]) {
            const cartItem = params.cart.find((c) => c.inventoryId === row.inventory_id);
            if (!cartItem) continue;
            stockDeductions.push({
              inventoryId: row.inventory_id,
              quantity: cartItem.quantity,
              originalQty: row.original_qty,
            });
          }
          return { success: true };
        }

        // ─── Legacy per-item fallback (pre-migration only) ───────────
        // Pre-fix: did SELECT-then-UPDATE-then-INSERT, which collided with
        // the BEFORE INSERT trigger `sync_inventory_on_stock_movement_insert`
        // (verified function `sync_inventory_quantity()` 2026-04-25). Net
        // effect: 2× decrement on every fallback sale (e.g. 10 → 6 instead
        // of 8 for a quantity 2 sold). Now: pre-flight stock check for
        // friendly error UX, but the INSERT alone is the write — trigger
        // handles inventory.quantity + quantity_after.
        for (const item of params.cart) {
          const { data: inv } = await admin
            .from("inventory")
            .select("quantity, name")
            .eq("id", item.inventoryId)
            .eq("tenant_id", tenantId)
            .single();
          if (!inv) continue;
          const available = inv.quantity;
          if (available - item.quantity < 0) {
            return {
              success: false,
              error: `Insufficient stock for "${inv.name || item.name}". Available: ${available}, Requested: ${item.quantity}`,
            };
          }
          const { error: insErr } = await admin.from("stock_movements").insert({
            tenant_id: tenantId,
            inventory_id: item.inventoryId,
            movement_type: "sale",
            quantity_change: -item.quantity,
            notes: `POS Sale ${saleNumber}`,
            created_by: userId,
          });
          if (insErr) {
            return { success: false, error: insErr.message };
          }
          stockDeductions.push({
            inventoryId: item.inventoryId,
            quantity: item.quantity,
            originalQty: available,
          });
        }
        return { success: true };
      },
      compensate: async () => {
        // Restore stock for all deducted items. Compensating
        // rollback — log on each failure, continue restoring the
        // others. A partial-rollback failure is logged for operator
        // reconciliation; throwing here would leave the remaining
        // items un-restored.
        for (const deduction of stockDeductions) {
          const { error: restoreErr } = await admin
            .from("inventory")
            .update({ quantity: deduction.originalQty })
            .eq("id", deduction.inventoryId)
            .eq("tenant_id", tenantId);
          if (restoreErr) {
            logger.error("[pos/checkout] stock rollback failed", { inventoryId: deduction.inventoryId, err: restoreErr });
          }
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
            p_tenant_id: tenantId,
          });

          const posLocationIdInv = await resolvePOSLocationId(tenantId, userId);
          // Full payload — includes sale_id linkage. On schemas where the
          // sale_id column hasn't been added yet (older tenants), PostgREST
          // rejects with "column not found", so we retry without that one
          // optional field. The sale still completes, the invoice still
          // lands, and the link gets restored on the next visit once the
          // accompanying migration lands.
          const basePayload: Record<string, unknown> = {
            tenant_id: tenantId,
            location_id: posLocationIdInv,
            invoice_number: invoiceNumberData ?? `INV-${Date.now()}`,
            customer_id: params.customerId,
            customer_name: params.customerName,
            customer_email: params.customerEmail,
            invoice_date: new Date().toISOString().split("T")[0],
            // W3-CRIT-04: server-recomputed amounts; tenant config (not
            // params.taxName / params.taxRate) is the source of truth.
            subtotal: serverTotals.subtotal,
            discount_amount: serverDiscount,
            tax_name: taxCfg.tax_name,
            tax_rate: taxCfg.tax_rate,
            tax_inclusive: false, // POS formula is always exclusive — see recompute note
            tax_amount: serverTotals.taxAmount,
            total: serverTotals.total,
            amount_paid: serverTotals.total,
            status: "paid",
            paid_at: new Date().toISOString(),
            created_by: userId,
          };
          // Refactored to explicit { data, error } destructure so the
          // ESLint rule sees the error capture (and so the schema-
          // missing-column retry path keeps the same behaviour).
          let { data: newInvoice, error: invErr } = await admin
            .from("invoices")
            .insert({ ...basePayload, sale_id: saleId })
            .select("id")
            .single();
          if (invErr && /sale_id|schema cache/i.test(invErr.message)) {
            // Retry without sale_id so POS invoice creation doesn't silently
            // disappear on schemas missing the column.
            const { data: retryData, error: retryErr } = await admin
              .from("invoices")
              .insert(basePayload)
              .select("id")
              .single();
            newInvoice = retryData;
            invErr = retryErr;
          }

          if (newInvoice) {
            invoiceId = newInvoice.id;
            // Side-effect — invoice creation is in a "non-critical"
            // wrapper (this whole step returns success regardless).
            // Log on error so the operator can spot drift; the sale
            // already completed.
            const { error: liErr } = await admin.from("invoice_line_items").insert(
              params.cart.map((item, idx) => ({
                tenant_id: tenantId,
                invoice_id: newInvoice.id,
                description: item.name,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                discount_pct: 0,
                sort_order: idx,
              }))
            );
            if (liErr) {
              logger.error("[pos/checkout] invoice_line_items insert failed (non-fatal)", { invoiceId: newInvoice.id, err: liErr });
            }
          } else if (invErr) {
            logger.warn("POS invoice insert failed", { err: invErr.message });
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

        // Schema only exposes: amount, reason, sale_id, refund_id,
        // created_by. Earlier the insert sent balance_after /
        // reference_type / reference_id which don't exist; the insert
        // errored and the unawaited promise was discarded so every
        // POS-store-credit purchase was missing its audit row. Refs
        // resolve via sale_id (no need for the generic shape).
        // newBalance is recomputed downstream from customers.store_credit
        // and isn't needed in the history row.
        const { error: histErr } = await admin
          .from("customer_store_credit_history")
          .insert({
            tenant_id: tenantId,
            customer_id: params.customerId,
            amount: -(params.storeCreditAmount || 0),
            reason: "POS Purchase",
            sale_id: saleId,
            created_by: userId,
          });
        if (histErr) {
          logger.error("[pos/record_credit_history] insert failed", { err: histErr });
        }

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

        // Schema columns are `amount` + `redeemed_by` + `created_at`;
        // earlier code wrote `amount_used` + `redeemed_at` (neither
        // exist), so every redemption silently failed to log. The
        // gift_vouchers.balance was still decremented by the prior
        // step, leaving redemption + balance out of sync.
        const { error: redErr } = await admin
          .from("gift_voucher_redemptions")
          .insert({
            voucher_id: params.voucherId,
            sale_id: saleId,
            amount: params.voucherAmount,
            tenant_id: tenantId,
            redeemed_by: userId,
          });
        if (redErr) {
          logger.error("[pos/record_voucher_history] insert failed", { err: redErr });
        }

        return { success: true };
      },
    },
  ];

  // Execute with safety wrapper
  const result = await executeWithSafety(
    admin,
    "pos_sale",
    saleNumber,
    tenantId,
    userId,
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
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to create sale" };
  }
}

// ─── Layby Sale ───────────────────────────────────────────────────────────────

interface CreateLaybySaleParams {
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
    // SECURITY: Session-derive tenant + user. Previously (W3-CRIT-03) this
    // action accepted tenantId + userId from the body, allowing cross-tenant
    // layby creation.
    const ctx = await getAuthContext();
    if (!ctx) return { error: "Not authenticated" };
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;

    try {
      await assertTenantActive(tenantId);
    } catch {
      return { error: "Your subscription is inactive. Please update billing to continue." };
    }

    if (!params.customerId) return { error: "Customer is required for layby" };
    if (params.depositAmount <= 0) return { error: "Deposit must be greater than zero" };
    if (params.depositAmount >= params.total) return { error: "Deposit must be less than total — use regular sale instead" };

    const admin = createAdminClient();

  // ─── W3-CRIT-04: server-authoritative money recompute (layby) ──────────
  // Same rationale as createPOSSale. Layby records commit the customer
  // to a final total that gets paid off across multiple payments; a
  // client-supplied bogus total here would corrupt the remaining-balance
  // math forever. Recompute, compare, reject on divergence.
  const laybyTaxCfg = await getTenantTaxConfig(tenantId);
  const laybyServerDiscount = clampDiscount(
    params.discountAmount,
    params.cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
  );
  const laybyServerTotals = computeMoneyTotals(
    params.cart.map((c) => ({ quantity: c.quantity, unit_price: c.unitPrice })),
    laybyTaxCfg.tax_rate,
    false, // POS formula is exclusive — see note on createPOSSale
    laybyServerDiscount
  );
  if (Math.abs(laybyServerTotals.total - params.total) > 0.01) {
    logger.warn("[createLaybySale] client total mismatch — rejecting", {
      tenantId,
      clientTotal: params.total,
      serverTotal: laybyServerTotals.total,
    });
    return {
      error: `Client total mismatch. Expected $${laybyServerTotals.total.toFixed(2)}, got $${params.total.toFixed(2)}.`,
    };
  }
  // Re-check deposit-vs-total against the *server* total (param.total is
  // now proven to match, but a client could send deposit=total-1 with
  // total already inflated — use server total for the bound).
  if (params.depositAmount >= laybyServerTotals.total) {
    return { error: "Deposit must be less than total — use regular sale instead" };
  }

  // Generate sale number via the atomic next_sale_number RPC, same as
  // createPOSSale (line 137). Pre-fix used count+1 which is race-prone:
  // two POS terminals starting a layby simultaneously both compute the
  // same number; sales_tenant_number_unique then fails one of them
  // outright. Using the RPC sequences atomically.
  const { data: laybySaleNumber, error: laybyNumErr } = await admin.rpc(
    "next_sale_number",
    { p_tenant_id: tenantId },
  );
  if (laybyNumErr || !laybySaleNumber) {
    return { error: "Failed to allocate sale number — please retry." };
  }
  const saleNumber = laybySaleNumber as string;

  // Create layby sale record (status='layby', inventory NOT yet deducted)
  const laybyLocationId = await resolvePOSLocationId(tenantId, userId);
  const { data: sale, error: saleErr } = await admin
    .from("sales")
    .insert({
      tenant_id: tenantId,
      location_id: laybyLocationId,
      sale_number: saleNumber,
      customer_id: params.customerId,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      // W3-CRIT-04: server-recomputed money only
      subtotal: laybyServerTotals.subtotal,
      discount_amount: laybyServerDiscount,
      tax_amount: laybyServerTotals.taxAmount,
      total: laybyServerTotals.total,
      payment_method: "layby",
      store_credit_amount: 0,
      status: "layby",
      sold_by: userId,
      sale_date: new Date().toISOString().split("T")[0],
      deposit_amount: params.depositAmount,
      amount_paid: params.depositAmount,
    })
    .select("id")
    .single();

  if (saleErr || !sale) return { error: saleErr?.message ?? "Failed to create layby" };

  // Record initial deposit payment. Destructive — record-of-truth
  // for money received; if this fails the layby sale exists but the
  // customer's deposit is "lost" until manual reconciliation.
  const { error: depErr } = await admin.from("layby_payments").insert({
    tenant_id: tenantId,
    sale_id: sale.id,
    amount: params.depositAmount,
    payment_method: "cash",
    notes: "Initial deposit",
    paid_by: userId,
    paid_at: new Date().toISOString(),
  });
  if (depErr) return { error: `layby deposit insert failed: ${depErr.message}` };

  // Create sale items (no inventory deduction — item reserved, not sold).
  // Destructive — line items are state-of-record for the layby; lost
  // rows mean the customer's reserved items vanish from the sale.
  if (params.cart.length > 0) {
    const { error: liErr } = await admin.from("sale_items").insert(
      params.cart.map((item, idx) => ({
        tenant_id: tenantId,
        sale_id: sale.id,
        description: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        // W3-CRIT-04: server-authoritative line_total
        line_total: laybyServerTotals.lineTotals[idx],
        inventory_id: item.inventoryId,
      }))
    );
    if (liErr) return { error: `layby sale_items insert failed: ${liErr.message}` };
  }

    // Invalidate dashboard cache
    revalidateTag("dashboard", "default");
    return { id: sale.id, saleNumber };
  } catch (err) {
    logger.error("[createLaybySale] Error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to create layby sale" };
  }
}
