"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { invalidateCache, tenantCacheKey } from "@/lib/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import logger from "@/lib/logger";
import { resolveLocationForCreate, LOCATION_REQUIRED_MESSAGE } from "@/lib/active-location";
import { assertTenantActive } from "@/lib/assert-tenant-active";

// Intake inserts (repair / bespoke / sale) all go through the shared
// resolveLocationForCreate policy: cookie → single-location auto →
// multi-location reject. Returns { locationId } or throws with the
// LOCATION_REQUIRED_MESSAGE so the form surfaces it instead of silently
// orphaning a row with location_id=NULL.
async function resolveActiveLocationId(tenantId: string, userId: string): Promise<string | null> {
  const r = await resolveLocationForCreate(tenantId, userId);
  if (r.needsSelection) throw new Error(LOCATION_REQUIRED_MESSAGE);
  return r.locationId;
}

// ────────────────────────────────────────────────────────────────
// SQL Injection Prevention - Sanitize LIKE patterns
// ────────────────────────────────────────────────────────────────

/**
 * Escapes special PostgreSQL LIKE pattern characters to prevent injection.
 * Characters % and _ have special meaning in LIKE patterns.
 * Also escapes backslash which is the escape character.
 */
function sanitizeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')  // Escape backslash first
    .replace(/%/g, '\\%')    // Escape percent
    .replace(/_/g, '\\_');   // Escape underscore
}

// ────────────────────────────────────────────────────────────────
// Intake Observability Logging
// ────────────────────────────────────────────────────────────────

type IntakeJobType = 'repair' | 'bespoke' | 'stock';
type IntakeEventType = 'started' | 'succeeded' | 'failed';

interface IntakeLogData {
  event: IntakeEventType;
  jobType: IntakeJobType;
  tenantId: string;
  userId: string;
  customerId?: string | null;
  entityId?: string;
  entityNumber?: string;
  invoiceId?: string;
  errorCategory?: string;
  errorMessage?: string;
  quotedPrice?: number;
  depositAmount?: number;
  paymentReceived?: number;
  timestamp: string;
}

function logIntakeEvent(data: IntakeLogData) {
  const prefix = `[INTAKE][${data.jobType.toUpperCase()}][${data.event.toUpperCase()}]`;
  const logData = {
    ...data,
    _intakeAudit: true, // Tag for log filtering
  };
  
  if (data.event === 'failed') {
    logger.error(`${prefix} tenant=${data.tenantId} user=${data.userId} error=${data.errorCategory}: ${data.errorMessage}`, logData);
  } else if (data.event === 'succeeded') {
    logger.info(`${prefix} tenant=${data.tenantId} user=${data.userId} entityId=${data.entityId} entityNumber=${data.entityNumber}`, logData);
  } else {
    logger.info(`${prefix} tenant=${data.tenantId} user=${data.userId}`, logData);
  }
}

// ────────────────────────────────────────────────────────────────
// Auth Helper
// ────────────────────────────────────────────────────────────────

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  // Paywall choke point. See src/lib/assert-tenant-active.ts.
  await assertTenantActive(userData.tenant_id);

  return { supabase, admin, userId: user.id, tenantId: userData.tenant_id };
}

// ────────────────────────────────────────────────────────────────
// Customer Actions
// ────────────────────────────────────────────────────────────────

interface CustomerSearchResult {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  notes: string | null;
}

export async function searchCustomers(query: string): Promise<{ data?: CustomerSearchResult[]; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();
    
    // Sanitize query to prevent SQL injection via LIKE patterns
    const safeQuery = sanitizeLikePattern(query);
    
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, first_name, last_name, email, mobile, phone, notes")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,mobile.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`)
      .order("full_name")
      .limit(10);

    if (error) return { error: error.message };
    return { data: data ?? [] };
  } catch (err) {
    logger.error("[searchCustomers] Error:", err);
    return { error: err instanceof Error ? err.message : "Search failed" };
  }
}

export async function createCustomerInline(input: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}): Promise<{ id?: string; full_name?: string; error?: string }> {
  try {
    const { supabase, userId, tenantId } = await getAuthContext();

    const fullName = [input.first_name, input.last_name].filter(Boolean).join(" ");

    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        first_name: input.first_name || null,
        last_name: input.last_name || null,
        full_name: fullName || null,
        email: input.email || null,
        phone: input.phone || null,
        mobile: input.phone || null,
      })
      .select("id, full_name")
      .single();

    if (error) return { error: error.message };
    revalidateTag(CACHE_TAGS.customers(tenantId), "default");
    return { id: customer.id, full_name: customer.full_name };
  } catch (err) {
    logger.error("[createCustomerInline] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create customer" };
  }
}

// ────────────────────────────────────────────────────────────────
// Inventory/Stock Search
// ────────────────────────────────────────────────────────────────

interface InventorySearchResult {
  id: string;
  name: string | null;
  sku: string | null;
  barcode_value: string | null;
  jewellery_type: string | null;
  metal_type: string | null;
  metal_purity: string | null;
  stone_type: string | null;
  stone_carat: number | null;
  retail_price: number | null;
  quantity: number | null;
  primary_image: string | null;
}

export async function searchInventory(query: string): Promise<{ data?: InventorySearchResult[]; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();
    
    // Sanitize query to prevent SQL injection via LIKE patterns
    const safeQuery = sanitizeLikePattern(query);
    
    const { data, error } = await supabase
      .from("inventory")
      .select("id, name, sku, barcode_value, jewellery_type, metal_type, metal_purity, stone_type, stone_carat, retail_price, quantity, primary_image")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .eq("status", "active")
      .or(`name.ilike.%${safeQuery}%,sku.ilike.%${safeQuery}%,barcode_value.ilike.%${safeQuery}%`)
      .order("name")
      .limit(10);

    if (error) return { error: error.message };
    return { data: data ?? [] };
  } catch (err) {
    logger.error("[searchInventory] Error:", err);
    return { error: err instanceof Error ? err.message : "Search failed" };
  }
}

export async function getInventoryByBarcode(barcode: string): Promise<{ data?: InventorySearchResult; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();
    
    const { data, error } = await supabase
      .from("inventory")
      .select("id, name, sku, barcode_value, jewellery_type, metal_type, metal_purity, stone_type, stone_carat, retail_price, quantity, primary_image")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(`barcode_value.eq.${barcode},sku.eq.${barcode}`)
      .single();

    if (error) return { error: "Item not found" };
    return { data };
  } catch (err) {
    logger.error("[getInventoryByBarcode] Error:", err);
    return { error: err instanceof Error ? err.message : "Lookup failed" };
  }
}

// ────────────────────────────────────────────────────────────────
// Create Repair
// ────────────────────────────────────────────────────────────────

export interface CreateRepairInput {
  customer_id?: string | null;
  item_type: string;
  item_description: string;
  metal_type?: string | null;
  stones?: string | null;
  size_length?: string | null;
  identifying_details?: string | null;
  condition_notes?: string | null;
  issue_type?: string | null;
  work_description?: string | null;
  risk_notes?: string | null;
  priority: string;
  due_date?: string | null;
  quoted_price?: number | null;
  deposit_amount?: number | null;
  payment_received?: number | null;
  payment_method?: string | null;
}

export async function createRepairFromIntake(
  input: CreateRepairInput
): Promise<{ id?: string; repair_number?: string; invoice_id?: string; error?: string }> {
  let tenantId = '';
  let userId = '';
  
  try {
    const authContext = await getAuthContext();
    tenantId = authContext.tenantId;
    userId = authContext.userId;
    const { supabase, admin } = authContext;

    // Log intake started
    logIntakeEvent({
      event: 'started',
      jobType: 'repair',
      tenantId,
      userId,
      customerId: input.customer_id,
      quotedPrice: input.quoted_price ?? undefined,
      depositAmount: input.deposit_amount ?? undefined,
      paymentReceived: input.payment_received ?? undefined,
      timestamp: new Date().toISOString(),
    });

  // Generate repair number
  const { data: numData, error: numError } = await supabase.rpc(
    "next_repair_number",
    { p_tenant_id: tenantId }
  );
  if (numError) return { error: numError.message };

  const activeLocationId = await resolveActiveLocationId(tenantId, userId);
  const { data, error } = await supabase
    .from("repairs")
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      location_id: activeLocationId,
      repair_number: numData as string,
      customer_id: input.customer_id || null,
      item_type: input.item_type,
      item_description: input.item_description,
      metal_type: input.metal_type || null,
      condition_notes: input.condition_notes || null,
      repair_type: input.issue_type || "Other",
      work_description: input.work_description || null,
      priority: input.priority || "normal",
      due_date: input.due_date || null,
      quoted_price: input.quoted_price || null,
      deposit_amount: input.deposit_amount || null,
      deposit_paid: (input.payment_received ?? 0) > 0,
      stage: "intake",
      internal_notes: input.risk_notes ? `Risk notes: ${input.risk_notes}` : null,
    })
    .select("id, repair_number")
    .single();

  if (error) return { error: error.message };

  // Insert initial stage entry
  await supabase.from("repair_stages").insert({
    tenant_id: tenantId,
    repair_id: data.id,
    stage: "intake",
    notes: "Repair created via unified intake",
    created_by: userId,
  });

  let invoiceId: string | undefined;

  // Auto-create invoice if quoted_price OR deposit was provided
  const quotedPrice = input.quoted_price ?? 0;
  const paymentReceived = input.payment_received ?? 0;

  if (quotedPrice > 0 || paymentReceived > 0) {
    // Get tenant tax config
    const { data: tenantData } = await admin
      .from("tenants")
      .select("tax_rate, tax_name, tax_inclusive")
      .eq("id", tenantId)
      .single();

    const taxRate = tenantData?.tax_rate ?? 0.1;
    const taxInclusive = tenantData?.tax_inclusive ?? true;

    let subtotal: number;
    let taxAmount: number;
    let total: number;

    if (taxInclusive) {
      total = quotedPrice;
      taxAmount = total - total / (1 + taxRate);
      subtotal = total - taxAmount;
    } else {
      subtotal = quotedPrice;
      taxAmount = subtotal * taxRate;
      total = subtotal + taxAmount;
    }

    // Determine invoice status
    const invoiceStatus = paymentReceived >= total ? "paid" : paymentReceived > 0 ? "partial" : "unpaid";

    // Generate invoice number
    const { data: invNumData } = await supabase.rpc("next_invoice_number", {
      p_tenant_id: tenantId,
    });

    const amountDue = Math.max(0, Math.round((total - paymentReceived) * 100) / 100);
    
    const { data: invoice, error: invError } = await admin
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        location_id: activeLocationId,
        invoice_number: invNumData ?? `INV-${Date.now()}`,
        customer_id: input.customer_id || null,
        reference_type: "repair",
        reference_id: data.id,
        invoice_date: new Date().toISOString().split("T")[0],
        subtotal: Math.round(subtotal * 100) / 100,
        discount_amount: 0,
        tax_name: tenantData?.tax_name || "GST",
        tax_rate: taxRate,
        tax_inclusive: taxInclusive,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        amount_paid: paymentReceived,
        amount_due: amountDue,
        status: invoiceStatus,
        paid_at: invoiceStatus === "paid" ? new Date().toISOString() : null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (!invError && invoice) {
      invoiceId = invoice.id;

      // Create invoice line item for the repair work
      await admin.from("invoice_line_items").insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        description: `Repair: ${input.item_description}`,
        quantity: 1,
        unit_price: quotedPrice,
        discount_pct: 0,
        sort_order: 0,
      });

      // Link invoice to repair
      await admin
        .from("repairs")
        .update({ invoice_id: invoice.id })
        .eq("id", data.id)
        .eq("tenant_id", tenantId);

      // Record payment if made
      if (paymentReceived > 0) {
        await admin.from("payments").insert({
          tenant_id: tenantId,
          invoice_id: invoice.id,
          amount: paymentReceived,
          payment_method: input.payment_method || "cash",
          payment_date: new Date().toISOString().split("T")[0],
          notes: "Deposit at intake",
          created_by: userId,
        });
      }
    }
  }

  after(() => {
    revalidatePath("/repairs");
    revalidatePath("/workshop");
    revalidatePath("/invoices");
    revalidateTag("dashboard", "default");
    logIntakeEvent({
      event: 'succeeded',
      jobType: 'repair',
      tenantId,
      userId,
      customerId: input.customer_id,
      entityId: data.id,
      entityNumber: data.repair_number,
      invoiceId,
      quotedPrice: input.quoted_price ?? undefined,
      depositAmount: input.deposit_amount ?? undefined,
      paymentReceived: input.payment_received ?? undefined,
      timestamp: new Date().toISOString(),
    });
  });

  return { id: data.id, repair_number: data.repair_number, invoice_id: invoiceId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create repair";
    
    // Log intake failed
    logIntakeEvent({
      event: 'failed',
      jobType: 'repair',
      tenantId: tenantId || 'unknown',
      userId: userId || 'unknown',
      customerId: input.customer_id,
      errorCategory: 'exception',
      errorMessage,
      quotedPrice: input.quoted_price ?? undefined,
      depositAmount: input.deposit_amount ?? undefined,
      timestamp: new Date().toISOString(),
    });

    logger.error("[createRepairFromIntake] Error:", err);
    return { error: errorMessage };
  }
}

// ────────────────────────────────────────────────────────────────
// Create Bespoke Job
// ────────────────────────────────────────────────────────────────

export interface CreateBespokeInput {
  customer_id?: string | null;
  title: string;
  jewellery_type?: string | null;
  description?: string | null;
  design_source?: string | null;
  metal_type?: string | null;
  metal_colour?: string | null;
  metal_purity?: string | null;
  stone_type?: string | null;
  stone_details?: string | null;
  ring_size?: string | null;
  dimensions?: string | null;
  notes?: string | null;
  priority: string;
  due_date?: string | null;
  quoted_price?: number | null;
  deposit_amount?: number | null;
  payment_received?: number | null;
  payment_method?: string | null;
}

export async function createBespokeFromIntake(
  input: CreateBespokeInput
): Promise<{ id?: string; job_number?: string; invoice_id?: string; error?: string }> {
  let tenantId = '';
  let userId = '';
  
  try {
    const authContext = await getAuthContext();
    tenantId = authContext.tenantId;
    userId = authContext.userId;
    const { supabase, admin } = authContext;

    // Log intake started
    logIntakeEvent({
      event: 'started',
      jobType: 'bespoke',
      tenantId,
      userId,
      customerId: input.customer_id,
      quotedPrice: input.quoted_price ?? undefined,
      depositAmount: input.deposit_amount ?? undefined,
      paymentReceived: input.payment_received ?? undefined,
      timestamp: new Date().toISOString(),
    });

    // Generate job number
    const { data: numData, error: numError } = await supabase.rpc(
      "next_job_number",
    { p_tenant_id: tenantId }
  );
  if (numError) return { error: numError.message };

  const activeLocationId = await resolveActiveLocationId(tenantId, userId);
  const { data, error } = await supabase
    .from("bespoke_jobs")
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      location_id: activeLocationId,
      job_number: numData as string,
      customer_id: input.customer_id || null,
      title: input.title,
      jewellery_type: input.jewellery_type || null,
      description: input.description || null,
      metal_type: input.metal_type || null,
      metal_colour: input.metal_colour || null,
      metal_purity: input.metal_purity || null,
      stone_type: input.stone_type || null,
      ring_size: input.ring_size || null,
      priority: input.priority || "normal",
      due_date: input.due_date || null,
      quoted_price: input.quoted_price || null,
      deposit_amount: input.deposit_amount || null,
      deposit_received: (input.payment_received ?? 0) > 0,
      stage: "enquiry",
      internal_notes: input.design_source ? `Design source: ${input.design_source}` : null,
      client_notes: input.notes || null,
    })
    .select("id, job_number")
    .single();

  if (error) return { error: error.message };

  // Insert initial stage entry
  await supabase.from("bespoke_job_stages").insert({
    tenant_id: tenantId,
    job_id: data.id,
    stage: "enquiry",
    notes: "Job created via unified intake",
    created_by: userId,
  });

  let invoiceId: string | undefined;

  // Auto-create invoice if quoted_price OR deposit was provided
  const quotedPrice = input.quoted_price ?? 0;
  const paymentReceived = input.payment_received ?? 0;

  if (quotedPrice > 0 || paymentReceived > 0) {
    // Get tenant tax config
    const { data: tenantData } = await admin
      .from("tenants")
      .select("tax_rate, tax_name, tax_inclusive")
      .eq("id", tenantId)
      .single();

    const taxRate = tenantData?.tax_rate ?? 0.1;
    const taxInclusive = tenantData?.tax_inclusive ?? true;

    let subtotal: number;
    let taxAmount: number;
    let total: number;

    if (taxInclusive) {
      total = quotedPrice;
      taxAmount = total - total / (1 + taxRate);
      subtotal = total - taxAmount;
    } else {
      subtotal = quotedPrice;
      taxAmount = subtotal * taxRate;
      total = subtotal + taxAmount;
    }

    // Determine invoice status
    const invoiceStatus = paymentReceived >= total ? "paid" : paymentReceived > 0 ? "partial" : "unpaid";

    // Generate invoice number
    const { data: invNumData } = await supabase.rpc("next_invoice_number", {
      p_tenant_id: tenantId,
    });

    const amountDue = Math.max(0, Math.round((total - paymentReceived) * 100) / 100);
    
    const { data: invoice, error: invError } = await admin
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        location_id: activeLocationId,
        invoice_number: invNumData ?? `INV-${Date.now()}`,
        customer_id: input.customer_id || null,
        reference_type: "bespoke",
        reference_id: data.id,
        invoice_date: new Date().toISOString().split("T")[0],
        subtotal: Math.round(subtotal * 100) / 100,
        discount_amount: 0,
        tax_name: tenantData?.tax_name || "GST",
        tax_rate: taxRate,
        tax_inclusive: taxInclusive,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        amount_paid: paymentReceived,
        amount_due: amountDue,
        status: invoiceStatus,
        paid_at: invoiceStatus === "paid" ? new Date().toISOString() : null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (!invError && invoice) {
      invoiceId = invoice.id;

      // Create invoice line item for the bespoke work
      await admin.from("invoice_line_items").insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        description: `Bespoke: ${input.title}`,
        quantity: 1,
        unit_price: quotedPrice,
        discount_pct: 0,
        sort_order: 0,
      });

      // Link invoice to bespoke job
      await admin
        .from("bespoke_jobs")
        .update({ invoice_id: invoice.id })
        .eq("id", data.id)
        .eq("tenant_id", tenantId);

      // Record payment if made
      if (paymentReceived > 0) {
        await admin.from("payments").insert({
          tenant_id: tenantId,
          invoice_id: invoice.id,
          amount: paymentReceived,
          payment_method: input.payment_method || "cash",
          payment_date: new Date().toISOString().split("T")[0],
          notes: "Deposit at intake",
          created_by: userId,
        });
      }
    }
  }

  after(() => {
    revalidatePath("/bespoke");
    revalidatePath("/workshop");
    revalidatePath("/invoices");
    revalidateTag("dashboard", "default");
    logIntakeEvent({
      event: 'succeeded',
      jobType: 'bespoke',
      tenantId,
      userId,
      customerId: input.customer_id,
      entityId: data.id,
      entityNumber: data.job_number,
      invoiceId,
      quotedPrice: input.quoted_price ?? undefined,
      depositAmount: input.deposit_amount ?? undefined,
      paymentReceived: input.payment_received ?? undefined,
      timestamp: new Date().toISOString(),
    });
  });

  return { id: data.id, job_number: data.job_number, invoice_id: invoiceId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create bespoke job";
    
    // Log intake failed
    logIntakeEvent({
      event: 'failed',
      jobType: 'bespoke',
      tenantId: tenantId || 'unknown',
      userId: userId || 'unknown',
      customerId: input.customer_id,
      errorCategory: 'exception',
      errorMessage,
      quotedPrice: input.quoted_price ?? undefined,
      depositAmount: input.deposit_amount ?? undefined,
      timestamp: new Date().toISOString(),
    });

    logger.error("[createBespokeFromIntake] Error:", err);
    return { error: errorMessage };
  }
}

// ────────────────────────────────────────────────────────────────
// Create Stock Item Sale
// ────────────────────────────────────────────────────────────────

export interface CreateStockSaleInput {
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  inventory_id: string;
  item_name: string;
  price: number;
  payment_received?: number | null;
  payment_method?: string | null;
  create_invoice?: boolean;
}

export async function createStockSaleFromIntake(
  input: CreateStockSaleInput
): Promise<{ id?: string; sale_number?: string; invoice_id?: string; error?: string }> {
  let tenantId = '';
  let userId = '';
  
  try {
    const authContext = await getAuthContext();
    tenantId = authContext.tenantId;
    userId = authContext.userId;
    const { supabase } = authContext;

    // Log intake started
    logIntakeEvent({
      event: 'started',
      jobType: 'stock',
      tenantId,
      userId,
      customerId: input.customer_id,
      quotedPrice: input.price,
      paymentReceived: input.payment_received ?? undefined,
      timestamp: new Date().toISOString(),
    });

  // Generate sale number
  const { data: saleNumberData, error: saleNumErr } = await supabase.rpc(
    "next_sale_number",
    { p_tenant_id: tenantId }
  );
  
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

  // Get customer details if we have customer_id
  let customerName = input.customer_name;
  let customerEmail = input.customer_email;
  if (input.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("full_name, email")
      .eq("id", input.customer_id)
      .single();
    if (customer) {
      customerName = customer.full_name;
      customerEmail = customer.email;
    }
  }

  // Get tenant tax config
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("tax_rate, tax_name, tax_inclusive")
    .eq("id", tenantId)
    .single();
  
  const taxRate = tenantData?.tax_rate ?? 0.1;
  const taxInclusive = tenantData?.tax_inclusive ?? true;
  
  let subtotal: number;
  let taxAmount: number;
  let total: number;
  
  if (taxInclusive) {
    total = input.price;
    taxAmount = total - total / (1 + taxRate);
    subtotal = total - taxAmount;
  } else {
    subtotal = input.price;
    taxAmount = subtotal * taxRate;
    total = subtotal + taxAmount;
  }

  const paymentReceived = input.payment_received ?? 0;
  const status = paymentReceived >= total ? "paid" : paymentReceived > 0 ? "partial" : "quote";

  // Create sale
  const activeLocationId = await resolveActiveLocationId(tenantId, userId);
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      tenant_id: tenantId,
      location_id: activeLocationId,
      sale_number: saleNumber,
      customer_id: input.customer_id || null,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      status,
      payment_method: input.payment_method || null,
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      discount_amount: 0,
      sold_by: userId,
    })
    .select("id")
    .single();

  if (saleError) return { error: saleError.message };

  // Create sale item
  await supabase.from("sale_items").insert({
    tenant_id: tenantId,
    sale_id: sale.id,
    inventory_id: input.inventory_id,
    description: input.item_name,
    quantity: 1,
    unit_price: input.price,
    line_total: input.price,
  });

  // Deduct inventory quantity (race-safe with HARD FAIL)
  const { data: item } = await supabase
    .from("inventory")
    .select("quantity, name")
    .eq("id", input.inventory_id)
    .single();

  if (item) {
    const oldQty = item.quantity;
    const newQty = oldQty - 1;
    
    // HARD FAIL: Do not allow sale if out of stock
    if (newQty < 0) {
      // Void the sale we just created
      await supabase.from("sales").update({ status: "voided" }).eq("id", sale.id);
      
      // Log the out-of-stock failure
      logIntakeEvent({
        event: 'failed',
        jobType: 'stock',
        tenantId,
        userId,
        customerId: input.customer_id,
        errorCategory: 'out_of_stock',
        errorMessage: `Item "${item.name || input.item_name}" is out of stock`,
        quotedPrice: input.price,
        timestamp: new Date().toISOString(),
      });
      
      return { error: `Item "${item.name || input.item_name}" is out of stock` };
    }
    
    // Conditional update to prevent race
    const { count } = await supabase
      .from("inventory")
      .update({ quantity: newQty })
      .eq("id", input.inventory_id)
      .eq("quantity", oldQty);
    
    // If race occurred, retry with HARD FAIL
    let finalQty = newQty;
    if (count === 0) {
      const { data: itemRetry } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("id", input.inventory_id)
        .single();
      if (itemRetry) {
        finalQty = itemRetry.quantity - 1;
        if (finalQty < 0) {
          await supabase.from("sales").update({ status: "voided" }).eq("id", sale.id);
          
          // Log the race-condition out-of-stock failure
          logIntakeEvent({
            event: 'failed',
            jobType: 'stock',
            tenantId,
            userId,
            customerId: input.customer_id,
            errorCategory: 'race_out_of_stock',
            errorMessage: `Item "${item.name || input.item_name}" just sold out (race condition)`,
            quotedPrice: input.price,
            timestamp: new Date().toISOString(),
          });
          
          return { error: `Item "${item.name || input.item_name}" just sold out` };
        }
        await supabase
          .from("inventory")
          .update({ quantity: finalQty })
          .eq("id", input.inventory_id);
      }
    }

    await supabase.from("stock_movements").insert({
      tenant_id: tenantId,
      inventory_id: input.inventory_id,
      movement_type: "sale",
      quantity_change: -1,
      quantity_after: finalQty,
      notes: `Sold via intake - ${saleNumber}`,
      created_by: userId,
    });
  }

  // Create invoice if requested or if payment was made
  let invoiceId: string | undefined;
  if (input.create_invoice || paymentReceived > 0) {
    const { data: invoiceNumberData } = await supabase.rpc("next_invoice_number", {
      p_tenant_id: tenantId,
    });

    const amountDue = Math.max(0, Math.round((total - paymentReceived) * 100) / 100);
    
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        location_id: activeLocationId,
        invoice_number: invoiceNumberData ?? `INV-${Date.now()}`,
        customer_id: input.customer_id || null,
        sale_id: sale.id,
        invoice_date: new Date().toISOString().split("T")[0],
        subtotal: Math.round(subtotal * 100) / 100,
        discount_amount: 0,
        tax_name: tenantData?.tax_name || "GST",
        tax_rate: taxRate,
        tax_inclusive: taxInclusive,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        amount_paid: paymentReceived,
        amount_due: amountDue,
        status: paymentReceived >= total ? "paid" : paymentReceived > 0 ? "partial" : "unpaid",
        paid_at: paymentReceived >= total ? new Date().toISOString() : null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (!invError && invoice) {
      invoiceId = invoice.id;

      // Create invoice line item
      await supabase.from("invoice_line_items").insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        inventory_id: input.inventory_id,
        description: input.item_name,
        quantity: 1,
        unit_price: input.price,
        discount_pct: 0,
        sort_order: 0,
      });

      // Record payment if made
      if (paymentReceived > 0) {
        await supabase.from("payments").insert({
          tenant_id: tenantId,
          invoice_id: invoice.id,
          amount: paymentReceived,
          payment_method: input.payment_method || "cash",
          payment_date: new Date().toISOString().split("T")[0],
          created_by: userId,
        });
      }
    }
  }

  revalidatePath("/sales");
    revalidatePath("/inventory");
    revalidatePath("/invoices");
    // Invalidate dashboard and POS caches
    revalidateTag("dashboard", "default");
    await Promise.all([
      invalidateCache(tenantCacheKey(tenantId, "pos-inventory")),
      invalidateCache(tenantCacheKey(tenantId, "pos-customers")),
    ]);

    // Log intake succeeded
    logIntakeEvent({
      event: 'succeeded',
      jobType: 'stock',
      tenantId,
      userId,
      customerId: input.customer_id,
      entityId: sale.id,
      entityNumber: saleNumber,
      invoiceId,
      quotedPrice: input.price,
      paymentReceived: input.payment_received ?? undefined,
      timestamp: new Date().toISOString(),
    });

    return { id: sale.id, sale_number: saleNumber, invoice_id: invoiceId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create sale";
    
    // Log intake failed
    logIntakeEvent({
      event: 'failed',
      jobType: 'stock',
      tenantId: tenantId || 'unknown',
      userId: userId || 'unknown',
      customerId: input.customer_id,
      errorCategory: 'exception',
      errorMessage,
      quotedPrice: input.price,
      timestamp: new Date().toISOString(),
    });

    logger.error("[createStockSaleFromIntake] Error:", err);
    return { error: errorMessage };
  }
}

// ────────────────────────────────────────────────────────────────
// Get Data for Page Load
// ────────────────────────────────────────────────────────────────

interface IntakeCustomer {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
}

interface StockCategory {
  id: string;
  name: string;
}

interface TaxConfig {
  tax_rate: number;
  tax_name: string;
  tax_inclusive: boolean;
  currency: string;
}

export async function getIntakePageData(): Promise<{
  customers?: IntakeCustomer[];
  categories?: StockCategory[];
  taxConfig?: TaxConfig;
  error?: string;
}> {
  try {
    const { admin, tenantId } = await getAuthContext();

  const [customersRes, categoriesRes, taxRes] = await Promise.all([
    admin
      .from("customers")
      .select("id, full_name, email, mobile, phone")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("full_name")
      .limit(100),
    admin
      .from("stock_categories")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name"),
    admin
      .from("tenants")
      .select("tax_rate, tax_name, tax_inclusive, currency")
      .eq("id", tenantId)
      .single(),
  ]);

    return {
      customers: customersRes.data ?? [],
      categories: categoriesRes.data ?? [],
      taxConfig: taxRes.data ?? { tax_rate: 0.1, tax_name: "GST", tax_inclusive: true, currency: "AUD" },
    };
  } catch (err) {
    logger.error("[getIntakePageData] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to load intake data" };
  }
}
