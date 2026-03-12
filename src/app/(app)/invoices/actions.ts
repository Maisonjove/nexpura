"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

export interface LineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct?: number;
  sort_order?: number;
  inventory_id?: string | null;
}

export interface CreateInvoiceInput {
  customer_id: string;
  invoice_date: string;
  due_date?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  tax_name: string;
  tax_rate: number;
  tax_inclusive: boolean;
  discount_amount: number;
  notes?: string | null;
  footer_text?: string | null;
  line_items: LineItemInput[];
  status: "draft" | "sent";
}

function calcTotals(
  lineItems: LineItemInput[],
  taxRate: number,
  taxInclusive: boolean,
  discountAmount: number
): { subtotal: number; taxAmount: number; total: number } {
  const lineTotal = lineItems.reduce((sum, item) => {
    const disc = item.discount_pct ? item.discount_pct / 100 : 0;
    return sum + item.quantity * item.unit_price * (1 - disc);
  }, 0);

  let subtotal: number;
  let taxAmount: number;
  let total: number;

  if (taxInclusive) {
    total = lineTotal - discountAmount;
    taxAmount = total - total / (1 + taxRate);
    subtotal = total - taxAmount;
  } else {
    subtotal = lineTotal;
    taxAmount = subtotal * taxRate;
    total = subtotal + taxAmount - discountAmount;
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export async function createInvoice(input: CreateInvoiceInput): Promise<{ id: string }> {
  const { supabase, userId, tenantId } = await getAuthContext();

  // Generate invoice number via RPC
  const { data: invoiceNumberData, error: numErr } = await supabase.rpc(
    "next_invoice_number",
    { p_tenant_id: tenantId }
  );
  if (numErr) throw new Error(`Failed to generate invoice number: ${numErr.message}`);

  const { subtotal, taxAmount, total } = calcTotals(
    input.line_items,
    input.tax_rate,
    input.tax_inclusive,
    input.discount_amount
  );

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      invoice_number: invoiceNumberData as string,
      customer_id: input.customer_id || null,
      reference_type: input.reference_type || null,
      reference_id: input.reference_id || null,
      status: input.status,
      invoice_date: input.invoice_date,
      due_date: input.due_date || null,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: input.discount_amount,
      total,
      amount_paid: 0,
      tax_name: input.tax_name,
      tax_rate: input.tax_rate,
      tax_inclusive: input.tax_inclusive,
      notes: input.notes || null,
      footer_text: input.footer_text || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (invErr) throw new Error(`Failed to create invoice: ${invErr.message}`);
  if (!invoice) throw new Error("No invoice returned");

  // Insert line items
  if (input.line_items.length > 0) {
    const lineItemsData = input.line_items.map((item, idx) => ({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct ?? 0,
      sort_order: item.sort_order ?? idx,
      inventory_id: item.inventory_id || null,
    }));

    const { error: liErr } = await supabase
      .from("invoice_line_items")
      .insert(lineItemsData);

    if (liErr) throw new Error(`Failed to create line items: ${liErr.message}`);
  }

  revalidatePath("/invoices");
  return { id: invoice.id };
}

export async function updateInvoice(
  id: string,
  input: CreateInvoiceInput
): Promise<void> {
  const { supabase, tenantId } = await getAuthContext();

  // Check invoice is draft
  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "draft") throw new Error("Only draft invoices can be edited");

  const { subtotal, taxAmount, total } = calcTotals(
    input.line_items,
    input.tax_rate,
    input.tax_inclusive,
    input.discount_amount
  );

  const { error: invErr } = await supabase
    .from("invoices")
    .update({
      customer_id: input.customer_id || null,
      reference_type: input.reference_type || null,
      reference_id: input.reference_id || null,
      invoice_date: input.invoice_date,
      due_date: input.due_date || null,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: input.discount_amount,
      total,
      tax_name: input.tax_name,
      tax_rate: input.tax_rate,
      tax_inclusive: input.tax_inclusive,
      notes: input.notes || null,
      footer_text: input.footer_text || null,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (invErr) throw new Error(`Failed to update invoice: ${invErr.message}`);

  // Delete old line items and re-insert
  await supabase.from("invoice_line_items").delete().eq("invoice_id", id);

  if (input.line_items.length > 0) {
    const lineItemsData = input.line_items.map((item, idx) => ({
      tenant_id: tenantId,
      invoice_id: id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct ?? 0,
      sort_order: item.sort_order ?? idx,
      inventory_id: item.inventory_id || null,
    }));

    const { error: liErr } = await supabase
      .from("invoice_line_items")
      .insert(lineItemsData);

    if (liErr) throw new Error(`Failed to update line items: ${liErr.message}`);
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
}

export async function recordPayment(
  invoiceId: string,
  amount: number,
  paymentMethod: string,
  paymentDate: string,
  reference: string | null,
  notes: string | null
): Promise<void> {
  const { supabase, userId, tenantId } = await getAuthContext();

  // Get current invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, total, amount_paid, status")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .single();

  if (invErr || !invoice) throw new Error("Invoice not found");
  if (invoice.status === "voided") throw new Error("Cannot record payment on voided invoice");

  // INSERT ONLY — payments are immutable
  const { error: payErr } = await supabase.from("payments").insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    amount,
    payment_method: paymentMethod,
    payment_date: paymentDate,
    reference: reference || null,
    notes: notes || null,
    created_by: userId,
  });

  if (payErr) throw new Error(`Failed to record payment: ${payErr.message}`);

  // Update invoice amount_paid and status
  const newAmountPaid = (invoice.amount_paid || 0) + amount;
  const newStatus =
    newAmountPaid >= invoice.total ? "paid" : "partially_paid";
  const paidAt = newAmountPaid >= invoice.total ? new Date().toISOString() : null;

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
      ...(paidAt ? { paid_at: paidAt } : {}),
    })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId);

  if (updateErr) throw new Error(`Failed to update invoice: ${updateErr.message}`);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function markAsSent(invoiceId: string): Promise<void> {
  const { supabase, tenantId } = await getAuthContext();

  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent" })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .eq("status", "draft");

  if (error) throw new Error(`Failed to mark as sent: ${error.message}`);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function voidInvoice(invoiceId: string): Promise<void> {
  const { supabase, tenantId } = await getAuthContext();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .single();

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "paid") throw new Error("Cannot void a paid invoice");

  // Update status only — NEVER delete
  const { error } = await supabase
    .from("invoices")
    .update({ status: "voided" })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`Failed to void invoice: ${error.message}`);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function createInvoiceAndRedirect(input: CreateInvoiceInput): Promise<void> {
  const { id } = await createInvoice(input);
  redirect(`/invoices/${id}`);
}

export async function updateInvoiceAndRedirect(
  id: string,
  input: CreateInvoiceInput
): Promise<void> {
  await updateInvoice(id, input);
  redirect(`/invoices/${id}`);
}
