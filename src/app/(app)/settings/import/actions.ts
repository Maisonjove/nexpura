"use server";

import { createClient } from "@/lib/supabase/server";

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
  const { supabase, tenantId } = await getAuthContext();
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
  const { supabase, tenantId } = await getAuthContext();
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
  const { supabase, tenantId } = await getAuthContext();
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

      const record: Record<string, unknown> = {
        tenant_id: tenantId,
        full_name: fullName,
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        mobile: r.mobile?.trim() || null,
        address: r.address?.trim() || null,
        birthday: r.birthday?.trim() || null,
        ring_size: r.ring_size?.trim() || null,
        is_vip: r.is_vip === "true" || r.is_vip === true || r.is_vip === "yes" || r.is_vip === "1",
        preferred_metal: r.preferred_metal?.trim() || null,
        preferred_stone: r.preferred_stone?.trim() || null,
        notes: r.notes?.trim() || null,
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
  const { supabase, tenantId } = await getAuthContext();
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
  deposit_paid?: string | number;
  due_date?: string;
  notes?: string;
}

export async function importBespokeJobs(rows: BespokeJobRow[]): Promise<ImportResult> {
  const { supabase, tenantId } = await getAuthContext();
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
        deposit_paid: r.deposit_paid ? parseFloat(String(r.deposit_paid)) : null,
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
  const { supabase, tenantId } = await getAuthContext();
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
}
