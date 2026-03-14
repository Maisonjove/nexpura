"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function convertQuoteToInvoice(quoteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) throw new Error("Quote not found");

  // Generate invoice number
  const { data: numData } = await supabase.rpc("next_invoice_number", { p_tenant_id: quote.tenant_id });

  // Create invoice
  const invoiceData = {
    tenant_id: quote.tenant_id,
    customer_id: quote.customer_id,
    invoice_number: numData,
    total: quote.total_amount,
    subtotal: quote.total_amount, // Assuming total is subtotal for now
    status: "draft",
    quote_id: quote.id,
    created_by: user.id
  };

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert(invoiceData)
    .select("id")
    .single();

  if (invoiceError) throw invoiceError;

  // Add line items
  const lineItems = quote.items.map((item: any) => ({
    tenant_id: quote.tenant_id,
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.quantity * item.unit_price
  }));

  const { error: itemsError } = await supabase
    .from("invoice_line_items")
    .insert(lineItems);

  if (itemsError) throw itemsError;

  // Update quote status
  await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId);

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/invoices");
  return invoice.id;
}

export async function convertQuoteToBespoke(quoteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) throw new Error("Quote not found");

  // Generate job number
  const { data: numData } = await supabase.rpc("next_job_number", { p_tenant_id: quote.tenant_id });

  // Create bespoke job
  const jobData = {
    tenant_id: quote.tenant_id,
    customer_id: quote.customer_id,
    job_number: numData,
    title: `Bespoke Job from Quote ${quote.quote_number || quoteId.slice(0, 8)}`,
    quoted_price: quote.total_amount,
    description: quote.items.map((i: any) => `${i.description} (Qty: ${i.quantity})`).join("\n"),
    stage: "enquiry",
    created_by: user.id
  };

  const { data: job, error: jobError } = await supabase
    .from("bespoke_jobs")
    .insert(jobData)
    .select("id")
    .single();

  if (jobError) throw jobError;

  // Add initial stage
  await supabase.from("bespoke_job_stages").insert({
    tenant_id: quote.tenant_id,
    job_id: job.id,
    stage: "enquiry",
    notes: "Converted from quote",
    created_by: user.id
  });

  // Update quote status
  await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId);

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  return job.id;
}

export async function convertQuoteToRepair(quoteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) throw new Error("Quote not found");

  // Generate repair number
  const { data: numData } = await supabase.rpc("next_repair_number", { p_tenant_id: quote.tenant_id });

  // Create repair
  const repairData = {
    tenant_id: quote.tenant_id,
    customer_id: quote.customer_id,
    repair_number: numData,
    item_type: "Jewellery",
    item_description: `Repair from Quote ${quote.quote_number || quoteId.slice(0, 8)}`,
    repair_type: "General",
    work_description: quote.items.map((i: any) => `${i.description} (Qty: ${i.quantity})`).join("\n"),
    quoted_price: quote.total_amount,
    stage: "intake",
    created_by: user.id
  };

  const { data: repair, error: repairError } = await supabase
    .from("repairs")
    .insert(repairData)
    .select("id")
    .single();

  if (repairError) throw repairError;

  // Add initial stage
  await supabase.from("repair_stages").insert({
    tenant_id: quote.tenant_id,
    repair_id: repair.id,
    stage: "intake",
    notes: "Converted from quote",
    created_by: user.id
  });

  // Update quote status
  await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId);

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  return repair.id;
}
