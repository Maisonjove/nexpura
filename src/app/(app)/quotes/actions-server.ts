"use server";

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";

// ── Types ────────────────────────────────────────────────────────────────────
export interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface QuoteInput {
  customer_id: string;
  items: QuoteItem[];
  total_amount: number;
  status?: string;
  expires_at?: string | null;
  notes?: string | null;
}

// ── CRUD Operations ──────────────────────────────────────────────────────────
export async function createQuote(input: QuoteInput): Promise<{ data?: unknown; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        tenant_id: userData.tenant_id,
        customer_id: input.customer_id,
        items: input.items,
        total_amount: input.total_amount,
        status: input.status || "draft",
        expires_at: input.expires_at || null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) {
      logger.error("[createQuote] Error:", error);
      return { error: error.message };
    }
    revalidatePath("/quotes");
    return { data };
  } catch (err) {
    logger.error("[createQuote] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create quote" };
  }
}

export async function updateQuote(id: string, input: Partial<QuoteInput>): Promise<{ data?: unknown; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    const { data, error } = await supabase
      .from("quotes")
      .update(input)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .select()
      .single();

    if (error) {
      logger.error("[updateQuote] Error:", error);
      return { error: error.message };
    }
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    return { data };
  } catch (err) {
    logger.error("[updateQuote] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to update quote" };
  }
}

export async function deleteQuote(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (error) {
      logger.error("[deleteQuote] Error:", error);
      return { error: error.message };
    }
    revalidatePath("/quotes");
    return {};
  } catch (err) {
    logger.error("[deleteQuote] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to delete quote" };
  }
}

// ── Tenant-scoped list fetch ─────────────────────────────────────────────────
export async function getQuotesList(): Promise<{ data?: unknown[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    const { data, error } = await supabase
      .from("quotes")
      .select("*, customers(full_name, email)")
      .eq("tenant_id", userData.tenant_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[getQuotesList] Error:", error);
      return { error: "Failed to load quotes" };
    }
    return { data: data ?? [] };
  } catch (err) {
    logger.error("[getQuotesList] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to load quotes" };
  }
}

export async function convertQuoteToInvoice(quoteId: string): Promise<{ id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Resolve tenant from session (never trust URL params)
    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!userData?.tenant_id) return { error: "No tenant found" };
    const tenantId = userData.tenant_id;

    // Get quote — explicitly scoped to this tenant
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("tenant_id", tenantId)
      .single();

    if (quoteError || !quote) {
      logger.error("[convertQuoteToInvoice] Quote not found:", quoteError);
      return { error: "Quote not found" };
    }

    // Generate invoice number
    const { data: numData, error: numError } = await supabase.rpc("next_invoice_number", { p_tenant_id: quote.tenant_id });
    if (numError) {
      logger.error("[convertQuoteToInvoice] Failed to generate invoice number:", numError);
      return { error: "Failed to generate invoice number" };
    }

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

    if (invoiceError) {
      logger.error("[convertQuoteToInvoice] Failed to create invoice:", invoiceError);
      return { error: "Failed to create invoice" };
    }

    // Add line items
    const lineItems = (quote.items as QuoteItem[]).map((item) => ({
      tenant_id: quote.tenant_id,
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_line_items")
      .insert(lineItems);

    if (itemsError) {
      logger.error("[convertQuoteToInvoice] Failed to add line items:", itemsError);
      return { error: "Failed to add invoice line items" };
    }

    // Update quote status
    const { error: updateError } = await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId);
    if (updateError) {
      logger.error("[convertQuoteToInvoice] Failed to update quote status:", updateError);
      // Non-fatal - invoice was created successfully
    }

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/invoices");
    return { id: invoice.id };
  } catch (err) {
    logger.error("[convertQuoteToInvoice] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to convert quote to invoice" };
  }
}

export async function convertQuoteToBespoke(quoteId: string): Promise<{ id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Resolve tenant from session (never trust URL params)
    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!userData?.tenant_id) return { error: "No tenant found" };
    const tenantId = userData.tenant_id;

    // Get quote — explicitly scoped to this tenant
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("tenant_id", tenantId)
      .single();

    if (quoteError || !quote) {
      logger.error("[convertQuoteToBespoke] Quote not found:", quoteError);
      return { error: "Quote not found" };
    }

    // Generate job number
    const { data: numData, error: numError } = await supabase.rpc("next_job_number", { p_tenant_id: quote.tenant_id });
    if (numError) {
      logger.error("[convertQuoteToBespoke] Failed to generate job number:", numError);
      return { error: "Failed to generate job number" };
    }

    // Create bespoke job
    const jobData = {
      tenant_id: quote.tenant_id,
      customer_id: quote.customer_id,
      job_number: numData,
      title: `Bespoke Job from Quote ${quote.quote_number || quoteId.slice(0, 8)}`,
      quoted_price: quote.total_amount,
      description: (quote.items as QuoteItem[]).map((i) => `${i.description} (Qty: ${i.quantity})`).join("\n"),
      stage: "enquiry",
      created_by: user.id
    };

    const { data: job, error: jobError } = await supabase
      .from("bespoke_jobs")
      .insert(jobData)
      .select("id")
      .single();

    if (jobError) {
      logger.error("[convertQuoteToBespoke] Failed to create bespoke job:", jobError);
      return { error: "Failed to create bespoke job" };
    }

    // Add initial stage
    const { error: stageError } = await supabase.from("bespoke_job_stages").insert({
      tenant_id: quote.tenant_id,
      job_id: job.id,
      stage: "enquiry",
      notes: "Converted from quote",
      created_by: user.id
    });
    if (stageError) {
      logger.error("[convertQuoteToBespoke] Failed to add initial stage:", stageError);
      // Non-fatal - job was created successfully
    }

    // Update quote status
    const { error: updateError } = await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId);
    if (updateError) {
      logger.error("[convertQuoteToBespoke] Failed to update quote status:", updateError);
      // Non-fatal - job was created successfully
    }

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/bespoke");
    return { id: job.id };
  } catch (err) {
    logger.error("[convertQuoteToBespoke] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to convert quote to bespoke job" };
  }
}

export async function convertQuoteToRepair(quoteId: string): Promise<{ id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Resolve tenant from session (never trust URL params)
    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!userData?.tenant_id) return { error: "No tenant found" };
    const tenantId = userData.tenant_id;

    // Get quote — explicitly scoped to this tenant
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("tenant_id", tenantId)
      .single();

    if (quoteError || !quote) {
      logger.error("[convertQuoteToRepair] Quote not found:", quoteError);
      return { error: "Quote not found" };
    }

    // Generate repair number
    const { data: numData, error: numError } = await supabase.rpc("next_repair_number", { p_tenant_id: quote.tenant_id });
    if (numError) {
      logger.error("[convertQuoteToRepair] Failed to generate repair number:", numError);
      return { error: "Failed to generate repair number" };
    }

    // Create repair
    const repairData = {
      tenant_id: quote.tenant_id,
      customer_id: quote.customer_id,
      repair_number: numData,
      item_type: "Jewellery",
      item_description: `Repair from Quote ${quote.quote_number || quoteId.slice(0, 8)}`,
      repair_type: "General",
      work_description: (quote.items as QuoteItem[]).map((i) => `${i.description} (Qty: ${i.quantity})`).join("\n"),
      quoted_price: quote.total_amount,
      stage: "intake",
      created_by: user.id
    };

    const { data: repair, error: repairError } = await supabase
      .from("repairs")
      .insert(repairData)
      .select("id")
      .single();

    if (repairError) {
      logger.error("[convertQuoteToRepair] Failed to create repair:", repairError);
      return { error: "Failed to create repair" };
    }

    // Add initial stage
    const { error: stageError } = await supabase.from("repair_stages").insert({
      tenant_id: quote.tenant_id,
      repair_id: repair.id,
      stage: "intake",
      notes: "Converted from quote",
      created_by: user.id
    });
    if (stageError) {
      logger.error("[convertQuoteToRepair] Failed to add initial stage:", stageError);
      // Non-fatal - repair was created successfully
    }

    // Update quote status
    const { error: updateError } = await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId);
    if (updateError) {
      logger.error("[convertQuoteToRepair] Failed to update quote status:", updateError);
      // Non-fatal - repair was created successfully
    }

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/repairs");
    return { id: repair.id };
  } catch (err) {
    logger.error("[convertQuoteToRepair] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to convert quote to repair" };
  }
}
