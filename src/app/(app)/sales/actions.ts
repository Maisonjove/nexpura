"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { refreshDashboardStatsAsync } from "@/app/(app)/dashboard/actions";
import { requirePermission } from "@/lib/auth-context";
import logger from "@/lib/logger";

import { flushSentry } from "@/lib/sentry-flush";
// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  return { supabase, userId: user.id, tenantId: userData.tenant_id };
}

// ────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────

// Canonical sales-list read lives in ./sales-actions.ts:getSales —
// it has the location-scope handling. Don't restore a legacy twin here.

export async function getSaleById(id: string) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data: sale, error } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !sale) return { data: null, error: error?.message ?? "Not found" };

  const { data: items } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", id)
    .order("created_at", { ascending: true });

  return { data: { ...sale, items: items ?? [] }, error: null };
}

export async function createSale(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  // W3-RBAC-04: sales create money-moving records (status=paid auto-
  // invoices). Gate on create_invoices — owners bypass.
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to create sales." : "Not authenticated" };
  }

  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  // Auto-generate sale number via RPC (respects configured sequence)
  const { data: saleNumberData, error: saleNumErr } = await supabase.rpc(
    "next_sale_number",
    { p_tenant_id: tenantId }
  );
  // Fall back to count-based if RPC not yet deployed
  let saleNumber: string;
  if (saleNumErr || !saleNumberData) {
    const { count } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    saleNumber = `SALE-${String((count ?? 0) + 1).padStart(4, "0")}`;
  } else {
    saleNumber = saleNumberData as string;
  }

  const str = (key: string) => (formData.get(key) as string) || null;
  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v && v !== "" ? parseFloat(v) : 0;
  };

  // Parse line items from JSON.
  // W3-CRIT-04: `line_total` and `discount_pct` arrive from the client but
  // are NEVER trusted — we recompute line_total on the server from
  // quantity * unit_price * (1 - discount_pct/100). A malicious client
  // previously could send unit_price=5000, line_total=5 and get a $5
  // sale recorded for a $5000 item.
  let lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct?: number;
    line_total?: number; // ignored server-side
    inventory_id?: string | null;
    sku?: string | null;
    name?: string | null;
  }> = [];
  try {
    const itemsJson = formData.get("line_items") as string;
    if (itemsJson) lineItems = JSON.parse(itemsJson);
  } catch {
    // ignore
  }

  const { data: tenantData } = await supabase
    .from("tenants")
    .select("tax_rate")
    .eq("id", tenantId)
    .single();
  const taxRate = tenantData?.tax_rate ?? 0.1;

  // Server-authoritative line totals + subtotal. Discount_pct is per-line
  // (staff-entered) and clamped to [0, 100].
  const serverLineTotals = lineItems.map((item) => {
    const disc = Math.min(Math.max(item.discount_pct ?? 0, 0), 100) / 100;
    return Math.round(item.quantity * item.unit_price * (1 - disc) * 100) / 100;
  });
  const subtotal = Math.round(
    lineItems.reduce((sum, item) => {
      const disc = Math.min(Math.max(item.discount_pct ?? 0, 0), 100) / 100;
      return sum + item.quantity * item.unit_price * (1 - disc);
    }, 0) * 100
  ) / 100;
  const discountAmountRaw = num("discount_amount");
  const discountAmount = Math.min(Math.max(discountAmountRaw, 0), subtotal);
  const taxAmount = Math.round((subtotal - discountAmount) * taxRate * 100) / 100;
  const total = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;

  // Split-payment: when payment_method=split the operator entered both a
  // card and cash amount; persist the totals and validate they sum to the
  // running total (with $0.01 float tolerance to mirror POS).
  const paymentMethod = str("payment_method");
  let splitNotes: string | null = null;
  if (paymentMethod === "split") {
    const cardAmt = num("split_card_amount");
    const cashAmt = num("split_cash_amount");
    if (Math.abs(cardAmt + cashAmt - total) > 0.01) {
      return { error: `Split payment must sum to ${total.toFixed(2)} (got ${(cardAmt + cashAmt).toFixed(2)})` };
    }
    splitNotes = `Split: card $${cardAmt.toFixed(2)} + cash $${cashAmt.toFixed(2)}`;
  }

  const baseNotes = str("notes");
  const combinedNotes = splitNotes ? `${splitNotes}${baseNotes ? `\n${baseNotes}` : ""}` : baseNotes;

  // Pre-flight stock check for any inventoried lines so we don't insert
  // the sale row before discovering an item went out of stock since the
  // operator added it.
  const inventoriedLines = lineItems.filter((it) => it.inventory_id);
  if (inventoriedLines.length > 0) {
    const ids = Array.from(new Set(inventoriedLines.map((i) => i.inventory_id!)));
    const { data: invRows } = await supabase
      .from("inventory")
      .select("id, name, quantity, track_quantity")
      .in("id", ids)
      .eq("tenant_id", tenantId);
    for (const line of inventoriedLines) {
      const inv = (invRows ?? []).find((r) => r.id === line.inventory_id);
      if (!inv) continue;
      if (inv.track_quantity === false) continue; // not tracked
      if ((inv.quantity ?? 0) < line.quantity) {
        return { error: `Only ${inv.quantity} "${inv.name}" left in stock — adjust the line quantity.` };
      }
    }
  }

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      tenant_id: tenantId,
      sale_number: saleNumber,
      customer_name: str("customer_name"),
      customer_email: str("customer_email"),
      status: str("status") || "quote",
      payment_method: paymentMethod,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: combinedNotes,
      sold_by: userId,
    })
    .select("id")
    .single();

  if (saleError || !sale) return { error: saleError?.message ?? "Failed to create sale" };

  // Notification for new sale
  await createNotification({
    tenantId,
    userId,
    type: "sale_created",
    title: `New sale ${saleNumber}`,
    body: `$${total.toFixed(2)}`,
    link: `/sales/${sale.id}`,
  });

  // Insert line items — now persists discount_percent, inventory_id, sku
  // alongside the description / qty / unit_price columns the form has
  // always shipped.
  if (lineItems.length > 0) {
    const saleItemsData = lineItems.map((item, idx) => ({
      tenant_id: tenantId,
      sale_id: sale.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      // W3-CRIT-04: server-authoritative line_total (not client-supplied)
      line_total: serverLineTotals[idx],
      discount_percent: Math.min(Math.max(item.discount_pct ?? 0, 0), 100),
      inventory_id: item.inventory_id ?? null,
      sku: item.sku ?? null,
    }));

    const { error: itemsError } = await supabase.from("sale_items").insert(saleItemsData);
    if (itemsError) return { error: itemsError.message };
  }

  // Decrement inventory for any line items linked to inventory rows. The
  // POS uses a single atomic RPC (pos_deduct_stock) for the whole-cart
  // FOR UPDATE + INSERT sequence; reuse it here so /sales/new's createSale
  // and /pos go through the same code path. Quote-status sales skip the
  // decrement (a quote isn't a sold-yet state).
  const status = str("status") || "quote";
  if (status !== "quote" && inventoriedLines.length > 0) {
    const admin = createAdminClient();
    const { error: stockErr } = await admin.rpc("pos_deduct_stock", {
      p_tenant_id: tenantId,
      p_items: inventoriedLines.map((c) => ({
        inventory_id: c.inventory_id,
        quantity: c.quantity,
        name: c.name ?? c.description,
      })),
      p_sale_number: saleNumber,
      p_user_id: userId,
    });
    if (stockErr) {
      // Roll back the sale row we just inserted so we don't leave a
      // money-entered record without the stock decrement that pairs with
      // it. The sale-items rows go away with the sale via cascade.
      // Compensating cleanup — log on error, continue. If sales.delete
      // succeeds, FK cascade clears sale_items. If both fail, operator
      // can manually clean up via /admin/tenants/[id].
      const { error: liDelErr } = await supabase.from("sale_items").delete().eq("sale_id", sale.id);
      if (liDelErr) {
        logger.error("[sales/create] rollback sale_items.delete failed", { saleId: sale.id, err: liDelErr });
      }
      const { error: saleDelErr } = await supabase.from("sales").delete().eq("id", sale.id);
      if (saleDelErr) {
        logger.error("[sales/create] rollback sales.delete failed", { saleId: sale.id, err: saleDelErr });
      }
      const m = /insufficient_stock\|(.+)\|(\-?\d+)$/.exec(stockErr.message);
      if (m) {
        const itemName = m[1];
        const available = Number(m[2]);
        await flushSentry();
        return {
          error:
            available === 0
              ? `"${itemName}" just sold out — please remove it from the sale.`
              : `Only ${available} "${itemName}" left in stock — adjust the line quantity.`,
        };
      }
      return { error: stockErr.message };
    }
  }

  // Invalidate dashboard cache. revalidatePath('/sales') chained with
  // redirect() raises "Failed to parse postponed state" 500s under
  // Next 16 cacheComponents (same root as the layby fix in 8d52e3b).
  // The redirect destination already refetches; the list page is
  // covered by the dashboard tag invalidation above. Drop the
  // revalidatePath call.
  revalidateTag("dashboard", "default");
  revalidateTag(CACHE_TAGS.invoices(tenantId), "default");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
  after(() => refreshDashboardStatsAsync(tenantId));

  redirect(`/sales/${sale.id}`);
}

export async function updateSaleStatus(
  id: string,
  status: string
): Promise<{ success?: boolean; error?: string; invoiceId?: string }> {
  // W3-HIGH-07 / W3-RBAC-04: updating a sale to paid/completed auto-
  // creates a paid invoice. That's a money-moving state change, gate
  // on create_invoices — owners bypass.
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to change sale status." : "Not authenticated" };
  }

  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  // P0 guard (C-01 root cause, 2026-05-06): reject status='refunded'
  // unless a refund row already exists for this sale. Pre-fix this
  // function accepted any status string, so anyone with the
  // create_invoices permission could fake-refund a sale by flipping
  // the dropdown — no refund row, no money moved, no GL, no audit.
  // Caught in prod on hello@nexpura sale b5b60d1a ($2,750, 2026-05-05).
  // The canonical refund path is processRefund() / /api/pos/refund —
  // they insert into refunds + refund_items, then flip the parent
  // sale to status='refunded' as the LAST step (and only when fully
  // refunded). So the only legitimate state in which the parent's
  // status flips to 'refunded' is one where a refunds row already
  // exists. Belt-and-suspenders: the UI dropdown also no longer
  // offers 'refunded' as a selectable value (SaleDetailClient.tsx).
  if (status === "refunded") {
    const { data: existingRefund } = await supabase
      .from("refunds")
      .select("id")
      .eq("original_sale_id", id)
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    if (!existingRefund?.id) {
      return {
        error:
          "Cannot mark sale as refunded directly. Process a refund through the refunds module — the parent sale is flipped automatically when the refund completes.",
      };
    }
  }

  const { error } = await supabase
    .from("sales")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  // Auto-create invoice when sale is marked as paid or completed
  if (status === "paid" || status === "completed") {
    const { data: sale } = await supabase
      .from("sales")
      .select("*")
      .eq("id", id)
      .single();

    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", id);

    if (sale) {
      // Check if invoice already exists for this sale
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("sale_id", id)
        .eq("tenant_id", tenantId)
        .single();

      if (!existingInvoice) {
        // Fetch tenant tax config
        const { data: tenantTaxData } = await supabase
          .from("tenants")
          .select("tax_name, tax_rate, tax_inclusive")
          .eq("id", tenantId)
          .single();
        const saleTaxName = tenantTaxData?.tax_name || "GST";
        const saleTaxRate = tenantTaxData?.tax_rate ?? 0.1;
        const saleTaxInclusive = tenantTaxData?.tax_inclusive ?? true;

        // Generate invoice number
        const { data: invoiceNumberData } = await supabase.rpc("next_invoice_number", {
          p_tenant_id: tenantId,
        });

        const lineItems = (saleItems ?? []).map((item, idx) => ({
          tenant_id: tenantId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_pct: item.discount_percent ?? 0,
          sort_order: idx,
        }));

        const { data: newInvoice, error: invErr } = await supabase
          .from("invoices")
          .insert({
            tenant_id: tenantId,
            invoice_number: invoiceNumberData ?? `INV-${Date.now()}`,
            customer_id: sale.customer_id ?? null,
            customer_name: sale.customer_name ?? null,
            customer_email: sale.customer_email ?? null,
            sale_id: id,
            invoice_date: new Date().toISOString().split("T")[0],
            subtotal: sale.subtotal,
            discount_amount: sale.discount_amount ?? 0,
            tax_name: saleTaxName,
            tax_rate: saleTaxRate,
            tax_inclusive: saleTaxInclusive,
            tax_amount: sale.tax_amount ?? 0,
            total: sale.total,
            status: status === "paid" ? "paid" : "unpaid",
            paid_at: status === "paid" ? new Date().toISOString() : null,
            notes: sale.notes ?? null,
            created_by: userId,
          })
          .select("id")
          .single();

        if (!invErr && newInvoice) {
          // Insert invoice line items. Destructive — line items
          // drive the invoice total + customer-facing billing.
          if (lineItems.length > 0) {
            const { error: liErr } = await supabase.from("invoice_line_items").insert(
              lineItems.map((li) => ({ ...li, invoice_id: newInvoice.id }))
            );
            if (liErr) return { error: `sale invoice-line-items insert failed: ${liErr.message}` };
          }
          // Invalidate dashboard cache
          revalidateTag("dashboard", "default");
  revalidateTag(CACHE_TAGS.invoices(tenantId), "default");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
  after(() => refreshDashboardStatsAsync(tenantId));
          return { success: true, invoiceId: newInvoice.id };
        }
      }
    }
  }

  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");
  revalidateTag(CACHE_TAGS.invoices(tenantId), "default");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
  after(() => refreshDashboardStatsAsync(tenantId));
  return { success: true };
}

export async function generatePassportFromSaleItem(
  saleId: string,
  itemDescription: string,
  inventoryId?: string | null
): Promise<{ success?: boolean; error?: string; passportId?: string }> {
  // W3-RBAC-04: gate passport generation (attaches sale → passport ids
  // that feed into customer-facing artifacts).
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to generate passports." : "Not authenticated" };
  }

  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  const { data: sale } = await supabase
    .from("sales")
    .select("*")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();

  if (!sale) return { error: "Sale not found" };

  // Generate passport number
  const { count } = await supabase
    .from("passports")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const passportNumber = `NXP-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: passport, error } = await supabase
    .from("passports")
    .insert({
      tenant_id: tenantId,
      passport_number: passportNumber,
      customer_id: sale.customer_id ?? null,
      inventory_id: inventoryId ?? null,
      item_name: itemDescription,
      purchase_date: new Date().toISOString().split("T")[0],
      is_public: true,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { success: true, passportId: passport?.id };
}

export async function deleteSale(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  // RBAC: deleting a sale wipes a money-entered record (and the sale
  // items under it). Gate on create_invoices — same bucket as refunds,
  // voucher-void, invoice-void.
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg };
  }
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId, userId } = ctx;

  // Restore inventory for any sale items that were tied to inventory rows.
  // Pre-fix this delete just wiped the sale + items, leaving the stock
  // permanently decremented. With soft-delete + restore, the stock
  // movements log a counter-entry and the item rows go back to where
  // they were before the sale.
  const { data: items } = await supabase
    .from("sale_items")
    .select("inventory_id, quantity")
    .eq("sale_id", id)
    .eq("tenant_id", tenantId);

  const admin = createAdminClient();
  for (const it of items ?? []) {
    if (!it.inventory_id) continue;
    // Destructive — stock_movements is the source of truth for
    // inventory reconciliation. A lost restore-row means stock
    // permanently shows decremented despite the sale being deleted.
    const { error: movErr } = await admin.from("stock_movements").insert({
      tenant_id: tenantId,
      inventory_id: it.inventory_id,
      movement_type: "adjustment",
      quantity_change: it.quantity,
      notes: `Sale deletion restore`,
      created_by: userId,
    });
    if (movErr) return { error: `stock-restore insert failed: ${movErr.message}` };
  }

  // Soft-delete the line items + sale rows. The deleted_at column was
  // added in 20260502_sales_soft_delete.sql; queries filter for
  // deleted_at IS NULL so these rows disappear from the list and KPIs.
  // Destructive — soft-delete is the state-of-record.
  const now = new Date().toISOString();
  const { error: liSoftDelErr } = await supabase
    .from("sale_items")
    .update({ deleted_at: now })
    .eq("sale_id", id)
    .eq("tenant_id", tenantId);
  if (liSoftDelErr) return { error: `sale_items soft-delete failed: ${liSoftDelErr.message}` };

  const { error } = await supabase
    .from("sales")
    .update({ deleted_at: now })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  // Drop revalidatePath('/sales') before redirect to avoid the
  // cacheComponents "Failed to parse postponed state" 500.
  revalidateTag("dashboard", "default");
  revalidateTag(CACHE_TAGS.invoices(tenantId), "default");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
  after(() => refreshDashboardStatsAsync(tenantId));
  redirect("/sales");
}

/**
 * Duplicate an existing sale into a new draft (status="quote"). Copies
 * customer, line items, discount; clears payment-state fields so the
 * operator chooses payment fresh. Inventory is NOT decremented since the
 * new row is a draft quote — that happens on the duplicate's eventual
 * paid/completed transition (or when /sales/new createSale path adds
 * inventory linking, depending on which path the operator confirms it
 * through).
 */
export async function duplicateSale(
  id: string
): Promise<{ id?: string; error?: string }> {
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to duplicate sales." : "Not authenticated" };
  }
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

  const { data: src } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();
  if (!src) return { error: "Sale not found" };

  const { data: srcItems } = await supabase
    .from("sale_items")
    .select("description, quantity, unit_price, discount_percent, line_total, inventory_id, sku")
    .eq("sale_id", id)
    .eq("tenant_id", tenantId);

  const { data: saleNumberData } = await supabase.rpc("next_sale_number", { p_tenant_id: tenantId });
  const saleNumber = (saleNumberData as string) || `SALE-${Date.now()}`;

  const { data: newSale, error: newErr } = await supabase
    .from("sales")
    .insert({
      tenant_id: tenantId,
      sale_number: saleNumber,
      customer_name: src.customer_name,
      customer_email: src.customer_email,
      status: "quote",
      payment_method: null,
      subtotal: src.subtotal,
      discount_amount: src.discount_amount,
      tax_amount: src.tax_amount,
      total: src.total,
      notes: src.notes,
      sold_by: userId,
      location_id: src.location_id,
    })
    .select("id")
    .single();
  if (newErr || !newSale) return { error: newErr?.message ?? "Failed to duplicate" };

  if ((srcItems ?? []).length > 0) {
    const itemsData = srcItems!.map((it) => ({
      tenant_id: tenantId,
      sale_id: newSale.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_percent: it.discount_percent ?? 0,
      line_total: it.line_total,
      inventory_id: it.inventory_id ?? null,
      sku: it.sku ?? null,
    }));
    // Destructive — duplicate sale's line items are state-of-record.
    const { error: dupLiErr } = await supabase.from("sale_items").insert(itemsData);
    if (dupLiErr) return { error: `duplicate sale line-items insert failed: ${dupLiErr.message}` };
  }

  revalidateTag("dashboard", "default");
  return { id: newSale.id };
}

/**
 * Update an existing sale's customer / line items / discount / payment
 * method / notes. Recomputes totals server-side from the line-item diff,
 * mirrors the percent + fixed discount semantics from createSale, and
 * adjusts inventory by the delta between the previous and new
 * inventoried-line quantities. Quote-status sales bypass the inventory
 * adjustment since a quote is not a sold-yet state in either direction.
 */
export async function updateSale(
  id: string,
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to edit sales." : "Not authenticated" };
  }
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }
  const { supabase, userId, tenantId } = ctx;

  const { data: existing } = await supabase
    .from("sales")
    .select("status, sale_number")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();
  if (!existing) return { error: "Sale not found" };

  const str = (key: string) => (formData.get(key) as string) || null;
  const num = (key: string) => {
    const v = formData.get(key) as string;
    return v && v !== "" ? parseFloat(v) : 0;
  };

  let lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct?: number;
    inventory_id?: string | null;
    sku?: string | null;
    name?: string | null;
  }> = [];
  try {
    const itemsJson = formData.get("line_items") as string;
    if (itemsJson) lineItems = JSON.parse(itemsJson);
  } catch {
    // ignore
  }

  const { data: tenantData } = await supabase
    .from("tenants")
    .select("tax_rate")
    .eq("id", tenantId)
    .single();
  const taxRate = tenantData?.tax_rate ?? 0.1;

  const serverLineTotals = lineItems.map((item) => {
    const disc = Math.min(Math.max(item.discount_pct ?? 0, 0), 100) / 100;
    return Math.round(item.quantity * item.unit_price * (1 - disc) * 100) / 100;
  });
  const subtotal = Math.round(serverLineTotals.reduce((s, n) => s + n, 0) * 100) / 100;
  const discountAmount = Math.min(Math.max(num("discount_amount"), 0), subtotal);
  const taxAmount = Math.round((subtotal - discountAmount) * taxRate * 100) / 100;
  const total = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;

  const paymentMethod = str("payment_method");
  let splitNotes: string | null = null;
  if (paymentMethod === "split") {
    const cardAmt = num("split_card_amount");
    const cashAmt = num("split_cash_amount");
    if (Math.abs(cardAmt + cashAmt - total) > 0.01) {
      return { error: `Split payment must sum to ${total.toFixed(2)} (got ${(cardAmt + cashAmt).toFixed(2)})` };
    }
    splitNotes = `Split: card $${cardAmt.toFixed(2)} + cash $${cashAmt.toFixed(2)}`;
  }
  const baseNotes = str("notes");
  const combinedNotes = splitNotes ? `${splitNotes}${baseNotes ? `\n${baseNotes}` : ""}` : baseNotes;

  // Inventory diff: pull old line items, compute net change per inventory_id.
  const { data: oldItems } = await supabase
    .from("sale_items")
    .select("inventory_id, quantity")
    .eq("sale_id", id)
    .eq("tenant_id", tenantId);

  const oldByInv = new Map<string, number>();
  for (const oi of oldItems ?? []) {
    if (oi.inventory_id) oldByInv.set(oi.inventory_id, (oldByInv.get(oi.inventory_id) ?? 0) + (oi.quantity ?? 0));
  }
  const newByInv = new Map<string, number>();
  for (const li of lineItems) {
    if (li.inventory_id) newByInv.set(li.inventory_id, (newByInv.get(li.inventory_id) ?? 0) + li.quantity);
  }
  const allInvIds = new Set<string>([...oldByInv.keys(), ...newByInv.keys()]);
  const status = existing.status;

  // Apply diff via stock_movements only when the sale is in a sold state.
  // Quote → quote edits don't touch stock; if the user is updating a
  // paid/completed sale, we adjust to the new line-item set.
  if (status !== "quote") {
    const admin = createAdminClient();
    for (const invId of allInvIds) {
      const oldQty = oldByInv.get(invId) ?? 0;
      const newQty = newByInv.get(invId) ?? 0;
      const delta = newQty - oldQty;
      if (delta === 0) continue;
      // Negative delta means we need to deduct more stock; positive means restore.
      // Destructive — stock_movements drives inventory reconciliation.
      const { error: movErr } = await admin.from("stock_movements").insert({
        tenant_id: tenantId,
        inventory_id: invId,
        movement_type: delta > 0 ? "sale" : "adjustment",
        quantity_change: -delta,
        notes: `Sale ${existing.sale_number} edit`,
        created_by: userId,
      });
      if (movErr) return { error: `stock-movement diff insert failed: ${movErr.message}` };
    }
  }

  // Replace line items wholesale (simpler than diffing per-line).
  // Destructive — clearing then re-inserting is the line-item update
  // strategy. A failed delete leaves the OLD line items in place and
  // the subsequent insert would create duplicates.
  const { error: liDelErr } = await supabase
    .from("sale_items")
    .delete()
    .eq("sale_id", id)
    .eq("tenant_id", tenantId);
  if (liDelErr) return { error: `sale_items pre-update clear failed: ${liDelErr.message}` };
  if (lineItems.length > 0) {
    const itemsData = lineItems.map((it, idx) => ({
      tenant_id: tenantId,
      sale_id: id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: serverLineTotals[idx],
      discount_percent: Math.min(Math.max(it.discount_pct ?? 0, 0), 100),
      inventory_id: it.inventory_id ?? null,
      sku: it.sku ?? null,
    }));
    const { error: insErr } = await supabase.from("sale_items").insert(itemsData);
    if (insErr) return { error: insErr.message };
  }

  const { error: upErr } = await supabase
    .from("sales")
    .update({
      customer_name: str("customer_name"),
      customer_email: str("customer_email"),
      payment_method: paymentMethod,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: combinedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (upErr) return { error: upErr.message };

  revalidateTag("dashboard", "default");
  revalidateTag(CACHE_TAGS.inventory(tenantId), "default");
  return { id };
}
