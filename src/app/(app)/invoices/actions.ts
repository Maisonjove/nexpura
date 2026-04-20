"use server";

/**
 * Invoice Server Actions
 * 
 * IMPORTANT: Database Computed Columns
 * -------------------------------------
 * The `invoices` table has the following DB-computed column:
 * 
 * - `amount_due`: Automatically computed as (total - amount_paid).
 *   This column is maintained by the database and should NOT be set manually.
 *   It updates automatically when `total` or `amount_paid` changes.
 * 
 * When creating/updating invoices, only set `total` and `amount_paid`.
 * The `amount_due` column is read-only in application code.
 */

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { refreshDashboardStatsAsync } from "@/app/(app)/dashboard/actions";
import { sendInvoiceEmail } from "@/lib/email/send";
import { withIdempotency, createPaymentFingerprint } from "@/lib/idempotency";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
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
  layout?: string | null;
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

export async function createInvoice(input: CreateInvoiceInput): Promise<{ id: string; error?: string }> {
  try {
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
      layout: input.layout || 'classic',
      created_by: userId,
    })
    .select("id")
    .single();

  if (invErr) throw new Error(`Failed to create invoice: ${invErr.message}`);
  if (!invoice) throw new Error("No invoice returned");

  // Auto-generate Stripe payment link (fire-and-forget)
  if (process.env.STRIPE_SECRET_KEY && total > 0 && input.status !== "draft") {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      
      // Create a product + price for this invoice, then a payment link
      const product = await stripe.products.create({
        name: `Invoice #${invoiceNumberData}`,
        metadata: { invoice_id: invoice.id, tenant_id: tenantId },
      });

      const price = await stripe.prices.create({
        product: product.id,
        currency: "aud",
        unit_amount: Math.round(total * 100),
      });
      
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { invoice_id: invoice.id, tenant_id: tenantId },
        after_completion: {
          type: "hosted_confirmation",
          hosted_confirmation: {
            custom_message: `Thank you! Your payment for Invoice #${invoiceNumberData} has been received.`
          }
        },
      });
      
      await supabase.from("invoices").update({ stripe_payment_link: paymentLink.url }).eq("id", invoice.id);
      logger.info(`[createInvoice] Stripe payment link created: ${paymentLink.url}`);
    } catch (stripeErr) {
      logger.warn("[createInvoice] Stripe payment link failed (non-fatal):", stripeErr);
    }
  }

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

  // Audit log
  await logAuditEvent({
    tenantId,
    userId,
    action: 'invoice_create',
    entityType: 'invoice',
    entityId: invoice.id,
    newData: { 
      invoice_number: invoiceNumberData,
      customer_id: input.customer_id,
      total,
      status: input.status,
    },
  });

  revalidatePath("/invoices");
  // Invalidate dashboard cache
  revalidateTag("dashboard", "default");
  revalidateTag(CACHE_TAGS.invoices(tenantId), "default");
  after(() => refreshDashboardStatsAsync(tenantId));
    return { id: invoice.id };
  } catch (err) {
    logger.error("[createInvoice] Error:", err);
    return { id: "", error: err instanceof Error ? err.message : "Failed to create invoice" };
  }
}

export async function updateInvoice(
  id: string,
  input: CreateInvoiceInput
): Promise<{ error?: string }> {
  try {
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
      layout: input.layout || 'classic',
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

  // Audit log
  const { userId, tenantId: auditTenantId } = await getAuthContext();
  await logAuditEvent({
    tenantId: auditTenantId,
    userId,
    action: 'invoice_update',
    entityType: 'invoice',
    entityId: id,
    newData: { total, status: input.status },
  });

  revalidatePath(`/invoices/${id}`);
    revalidatePath("/invoices");
    return {};
  } catch (err) {
    logger.error("[updateInvoice] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to update invoice" };
  }
}

export async function recordPayment(
  invoiceId: string,
  amount: number,
  paymentMethod: string,
  paymentDate: string,
  reference: string | null,
  notes: string | null
): Promise<{ error?: string }> {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();
    const admin = createAdminClient();

  // IDEMPOTENCY: Prevent duplicate payment submissions
  const fingerprint = createPaymentFingerprint(amount, paymentMethod, paymentDate);
  const result = await withIdempotency(
    "invoice_payment",
    tenantId,
    invoiceId,
    fingerprint,
    async () => {
      // Get current invoice status (just for voided check)
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .select("id, total, status")
        .eq("id", invoiceId)
        .eq("tenant_id", tenantId)
        .single();

      if (invErr || !invoice) throw new Error("Invoice not found");
      if (invoice.status === "voided") throw new Error("Cannot record payment on voided invoice");

      // INSERT payment (immutable)
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

      // ATOMIC: recalculate amount_paid from all payments (race-safe)
      const { data: allPayments } = await admin
        .from("payments")
        .select("amount")
        .eq("invoice_id", invoiceId)
        .eq("tenant_id", tenantId);

      const totalPaid = (allPayments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);
      const newStatus = totalPaid >= invoice.total ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
      const paidAt = totalPaid >= invoice.total ? new Date().toISOString() : null;

      const { error: updateErr } = await admin
        .from("invoices")
        .update({
          amount_paid: totalPaid,
          status: newStatus,
          ...(paidAt ? { paid_at: paidAt } : {}),
        })
        .eq("id", invoiceId)
        .eq("tenant_id", tenantId);

      if (updateErr) throw new Error(`Failed to update invoice: ${updateErr.message}`);

      return { success: true };
    }
  );

  if ("duplicate" in result && result.duplicate) {
      return { error: result.error };
    }

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    revalidatePath("/dashboard");
    // Invalidate dashboard cache
    revalidateTag("dashboard", "default");
    revalidateTag(CACHE_TAGS.invoices(tenantId), "default");
    return {};
  } catch (err) {
    logger.error("[recordPayment] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to record payment" };
  }
}

export async function markAsSent(invoiceId: string): Promise<{ customerEmail?: string | null; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();

  // If this draft was created via a repair/bespoke auto-invoice flow it has a
  // placeholder `DRAFT-XXXXXXXX` number. Upgrade to the canonical INV-####
  // sequence at send-time via the same RPC the /invoices flow uses, so every
  // sent invoice has the proper sequential number and the customer never sees
  // a "DRAFT-..." identifier on their received invoice.
  const { data: current } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .eq("status", "draft")
    .single();

  if (!current) throw new Error("Draft invoice not found");

  const updatePayload: { status: "unpaid"; invoice_number?: string } = { status: "unpaid" };
  if (current.invoice_number?.startsWith("DRAFT-")) {
    const { data: nextNum, error: numErr } = await supabase.rpc("next_invoice_number", { p_tenant_id: tenantId });
    if (numErr) throw new Error(`Failed to generate invoice number: ${numErr.message}`);
    updatePayload.invoice_number = nextNum as string;
  }

  const { error } = await supabase
    .from("invoices")
    .update(updatePayload)
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .eq("status", "draft");

  if (error) throw new Error(`Failed to mark as sent: ${error.message}`);

  // Send invoice email (fire-and-forget — don't block on error)
  const emailResult = await sendInvoiceEmail(invoiceId);
  
  // Get customer email for toast feedback
  let customerEmail: string | null = null;
  if (emailResult.success) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("customers(email)")
      .eq("id", invoiceId)
      .single();
    const customer = (Array.isArray(invoice?.customers) ? invoice?.customers[0] : invoice?.customers) as { email: string | null } | null;
    customerEmail = customer?.email ?? null;
  }

  revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    
    return { customerEmail };
  } catch (err) {
    logger.error("[markAsSent] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to mark as sent" };
  }
}

export async function voidInvoice(invoiceId: string): Promise<{ error?: string }> {
  try {
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

  if (error) return { error: `Failed to void invoice: ${error.message}` };

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    // Invalidate dashboard cache
    revalidateTag("dashboard", "default");
    revalidateTag(CACHE_TAGS.invoices(tenantId), "default");
    return {};
  } catch (err) {
    logger.error("[voidInvoice] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to void invoice" };
  }
}

export async function createInvoiceAndRedirect(input: CreateInvoiceInput): Promise<void> {
  const result = await createInvoice(input);
  if (result.error || !result.id) {
    // Don't redirect to /invoices/undefined — surface the error via throw so
    // the client form's catch handler shows it to the user instead of
    // silently landing them on a stale list page.
    throw new Error(result.error || "Failed to create invoice");
  }
  redirect(`/invoices/${result.id}`);
}

export async function updateInvoiceAndRedirect(
  id: string,
  input: CreateInvoiceInput
): Promise<void> {
  const result = await updateInvoice(id, input);
  if (result?.error) {
    throw new Error(result.error);
  }
  redirect(`/invoices/${id}`);
}
