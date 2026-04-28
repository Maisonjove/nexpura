"use server";

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-context";
import { getTenantTaxConfig, computeMoneyTotals } from "@/lib/tenant-tax";
import { resolveLocationForCreate, LOCATION_REQUIRED_MESSAGE } from "@/lib/active-location";

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
    // W3-RBAC-09: quotes are the entry-point to invoices. Gate on
    // create_invoices (same bucket as deleteQuote + voidInvoice).
    try {
      await requirePermission("create_invoices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "You don't have permission to create quotes." : "Not authenticated" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    // W3-CRIT-04: server-authoritative total. The client sends
    // `total_amount` for display, but we recompute from items. Quotes
    // themselves don't apply tax (a quote is a pre-tax offer — tax is
    // added at invoice creation), so the quote total is simply
    // sum(quantity * unit_price).
    const serverQuoteTotal = Math.round(
      input.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0) * 100
    ) / 100;

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        tenant_id: userData.tenant_id,
        customer_id: input.customer_id,
        items: input.items,
        total_amount: serverQuoteTotal,
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

    // Audit log
    await logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: 'quote_create',
      entityType: 'quote',
      entityId: data.id,
      newData: data as Record<string, unknown>,
    });

    revalidatePath("/quotes");
    return { data };
  } catch (err) {
    logger.error("[createQuote] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create quote" };
  }
}

export async function updateQuote(id: string, input: Partial<QuoteInput>): Promise<{ data?: unknown; error?: string }> {
  try {
    // W3-RBAC-09: gate quote edits on create_invoices.
    try {
      await requirePermission("create_invoices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "You don't have permission to update quotes." : "Not authenticated" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant found" };

    // Whitelist allowed update keys. Spreading the whole input let a
    // caller ship `tenant_id` and PostgREST would happily SET it (the
    // WHERE clause limits which row matches, not what's overwritten),
    // moving the quote across tenants. customer_id, items, status,
    // total_amount, expires_at, notes, terms, quote_number cover the
    // legitimate updates from the UI.
    const allowedKeys = [
      "customer_id",
      "items",
      "status",
      "total_amount",
      "expires_at",
      "notes",
      "terms",
      "quote_number",
    ] as const;
    const safe: Record<string, unknown> = {};
    for (const k of allowedKeys) {
      if (k in input) safe[k] = (input as Record<string, unknown>)[k];
    }
    const { data, error } = await supabase
      .from("quotes")
      .update(safe)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .select()
      .single();

    if (error) {
      logger.error("[updateQuote] Error:", error);
      return { error: error.message };
    }

    // Audit log
    await logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: 'quote_update',
      entityType: 'quote',
      entityId: id,
      newData: data as Record<string, unknown>,
    });

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
    // RBAC: quotes turn into invoices. Gate delete on create_invoices
    // (same financial-document bucket as refunds / invoice-void).
    try {
      await requirePermission("create_invoices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg };
    }
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

    // Audit log
    await logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: 'quote_delete',
      entityType: 'quote',
      entityId: id,
    });

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

    // `quotes` has no `deleted_at` column (verified against live schema).
    // Filtering on it returned a PG error and the list page rendered
    // "Failed to load quotes" for every tenant.
    const { data, error } = await supabase
      .from("quotes")
      .select("*, customers(full_name, email)")
      .eq("tenant_id", userData.tenant_id)
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
    // W3-RBAC-09: quote → invoice is a financial commit. Gate on
    // create_invoices.
    try {
      await requirePermission("create_invoices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "You don't have permission to convert quotes." : "Not authenticated" };
    }

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

    // W3-CRIT-04: previously this copied `quote.total_amount` into both
    // `total` and `subtotal` and dropped tax entirely, producing an
    // invoice that understated the bill by the tax component. Apply the
    // tenant's tax config the same way createInvoice does.
    const convertTaxCfg = await getTenantTaxConfig(tenantId);
    const convertTotals = computeMoneyTotals(
      (quote.items as QuoteItem[]).map((it) => ({ quantity: it.quantity, unit_price: it.unit_price })),
      convertTaxCfg.tax_rate,
      convertTaxCfg.tax_inclusive,
      0 // quotes carry no discount today; discount_amount=0
    );

    // Create invoice. Schema doesn't expose a `quote_id` column; the
    // generic ref shape is `reference_type` + `reference_id` (used for
    // sale_id and bespoke_job_id linkage too). Writing `quote_id`
    // returned PGRST204 and the whole conversion 500'd.
    const invoiceData = {
      tenant_id: quote.tenant_id,
      customer_id: quote.customer_id,
      invoice_number: numData,
      subtotal: convertTotals.subtotal,
      tax_name: convertTaxCfg.tax_name,
      tax_rate: convertTaxCfg.tax_rate,
      tax_inclusive: convertTaxCfg.tax_inclusive,
      tax_amount: convertTotals.taxAmount,
      total: convertTotals.total,
      status: "draft",
      reference_type: "quote",
      reference_id: quote.id,
      created_by: user.id,
    };

    // Atomicity: previously this did insert-invoice → insert-items →
    // update-quote in sequence, with each step's failure leaving the
    // previous steps committed. A line-items failure would strand an
    // invoice with zero rows and no owner action to reconcile it.
    //
    // New shape: insert invoice, attempt line items, COMPENSATE by
    // deleting the invoice if items fail. Quote status update is still
    // non-fatal (an unconverted-but-invoiced quote is cosmetic, not
    // data-corrupting).
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
      logger.error("[convertQuoteToInvoice] Failed to add line items — rolling back invoice:", itemsError);
      // Compensating rollback: delete the orphan invoice so it doesn't
      // sit in the list showing a $0 or wrong-total header with no
      // backing line items.
      const { error: rollbackError } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id)
        .eq("tenant_id", tenantId);
      if (rollbackError) {
        logger.error("[convertQuoteToInvoice] CRITICAL: rollback failed, orphan invoice left:", {
          invoiceId: invoice.id,
          error: rollbackError,
        });
      }
      return { error: "Failed to add invoice line items" };
    }

    // Update quote status — non-fatal; invoice is committed.
    // Defense in depth: tenant scope on the UPDATE even though the SELECT
    // above already filtered. Without `.eq("tenant_id", tenantId)` here
    // we'd rely entirely on RLS to block a forged quote_id from another
    // tenant — this gives us belt-and-braces.
    const { error: updateError } = await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId).eq("tenant_id", tenantId);
    if (updateError) {
      logger.error("[convertQuoteToInvoice] Failed to update quote status:", updateError);
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
    // W3-RBAC-09: quote → bespoke creates a workshop job + invoice.
    // Gate on create_invoices.
    try {
      await requirePermission("create_invoices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "You don't have permission to convert quotes." : "Not authenticated" };
    }

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

    // Resolve which location this bespoke job belongs to. Without
    // setting location_id explicitly the job inserts NULL, which makes
    // it invisible from any location-filtered view and silently
    // orphans jobs in multi-location tenants. Same shape as the
    // inventory fix in PR #44.
    const bespokeLoc = await resolveLocationForCreate(tenantId, user.id);
    if (bespokeLoc.needsSelection) {
      return { error: LOCATION_REQUIRED_MESSAGE };
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
      location_id: bespokeLoc.locationId,
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
    // Defense in depth: tenant scope on the UPDATE even though the SELECT
    // above already filtered. Without `.eq("tenant_id", tenantId)` here
    // we'd rely entirely on RLS to block a forged quote_id from another
    // tenant — this gives us belt-and-braces.
    const { error: updateError } = await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId).eq("tenant_id", tenantId);
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
    // W3-RBAC-09: quote → repair creates a job + invoice. Gate on
    // create_invoices.
    try {
      await requirePermission("create_invoices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "You don't have permission to convert quotes." : "Not authenticated" };
    }

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

    // Resolve location_id same as the bespoke conversion path.
    const repairLoc = await resolveLocationForCreate(tenantId, user.id);
    if (repairLoc.needsSelection) {
      return { error: LOCATION_REQUIRED_MESSAGE };
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
      location_id: repairLoc.locationId,
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
    // Defense in depth: tenant scope on the UPDATE even though the SELECT
    // above already filtered. Without `.eq("tenant_id", tenantId)` here
    // we'd rely entirely on RLS to block a forged quote_id from another
    // tenant — this gives us belt-and-braces.
    const { error: updateError } = await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId).eq("tenant_id", tenantId);
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
