"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications";
import { revalidatePath, revalidateTag } from "next/cache";

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

export async function getSales() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { data: null, error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  const { data, error } = await supabase
    .from("sales")
    .select("id, sale_number, customer_name, customer_email, status, payment_method, total, sale_date, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return { data, error: error?.message ?? null };
}

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

  // Parse line items from JSON
  let lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
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

  const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
  const discountAmount = num("discount_amount");
  const taxAmount = Math.round((subtotal - discountAmount) * taxRate * 100) / 100;
  const total = subtotal - discountAmount + taxAmount;

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      tenant_id: tenantId,
      sale_number: saleNumber,
      customer_name: str("customer_name"),
      customer_email: str("customer_email"),
      status: str("status") || "quote",
      payment_method: str("payment_method"),
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: str("notes"),
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

  // Insert line items
  if (lineItems.length > 0) {
    const saleItemsData = lineItems.map((item) => ({
      tenant_id: tenantId,
      sale_id: sale.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }));

    const { error: itemsError } = await supabase.from("sale_items").insert(saleItemsData);
    if (itemsError) return { error: itemsError.message };
  }

  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");
  revalidatePath("/sales");

  redirect(`/sales/${sale.id}`);
}

export async function updateSaleStatus(
  id: string,
  status: string
): Promise<{ success?: boolean; error?: string; invoiceId?: string }> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, userId, tenantId } = ctx;

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
          // Insert invoice line items
          if (lineItems.length > 0) {
            await supabase.from("invoice_line_items").insert(
              lineItems.map((li) => ({ ...li, invoice_id: newInvoice.id }))
            );
          }
          // Invalidate dashboard cache
          revalidateTag("dashboard", "default");
          return { success: true, invoiceId: newInvoice.id };
        }
      }
    }
  }

  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");
  return { success: true };
}

export async function generatePassportFromSaleItem(
  saleId: string,
  itemDescription: string,
  inventoryId?: string | null
): Promise<{ success?: boolean; error?: string; passportId?: string }> {
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
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  const { supabase, tenantId } = ctx;

  // Delete line items first
  await supabase.from("sale_items").delete().eq("sale_id", id).eq("tenant_id", tenantId);

  const { error } = await supabase
    .from("sales")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  
  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");
  revalidatePath("/sales");
  redirect("/sales");
}
