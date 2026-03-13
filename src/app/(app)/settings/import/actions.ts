"use server";

import { createClient } from "@/lib/supabase/server";

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

export interface CustomerRow {
  full_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  notes?: string;
}

export interface InventoryRow {
  name: string;
  sku?: string;
  category?: string;
  metal?: string;
  stone?: string;
  retail_price?: string | number;
  quantity?: string | number;
  description?: string;
}

export async function importCustomers(
  rows: CustomerRow[]
): Promise<{ imported: number; errors: string[] }> {
  const { supabase, tenantId } = await getAuthContext();
  const errors: string[] = [];
  let imported = 0;

  // Batch in chunks of 50
  const chunks = [];
  for (let i = 0; i < rows.length; i += 50) {
    chunks.push(rows.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const records = chunk
      .filter((r) => r.full_name?.trim())
      .map((r) => ({
        tenant_id: tenantId,
        full_name: r.full_name.trim(),
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        mobile: r.mobile?.trim() || null,
        address: r.address?.trim() || null,
        notes: r.notes?.trim() || null,
      }));

    if (records.length === 0) continue;

    const { error } = await supabase.from("customers").insert(records);
    if (error) {
      errors.push(`Batch error: ${error.message}`);
    } else {
      imported += records.length;
    }
  }

  return { imported, errors };
}

export async function importInventory(
  rows: InventoryRow[]
): Promise<{ imported: number; errors: string[] }> {
  const { supabase, tenantId } = await getAuthContext();
  const errors: string[] = [];
  let imported = 0;

  const chunks = [];
  for (let i = 0; i < rows.length; i += 50) {
    chunks.push(rows.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const records = chunk
      .filter((r) => r.name?.trim())
      .map((r) => ({
        tenant_id: tenantId,
        name: r.name.trim(),
        sku: r.sku?.trim() || null,
        category: r.category?.trim() || null,
        metal: r.metal?.trim() || null,
        stone: r.stone?.trim() || null,
        description: r.description?.trim() || null,
        retail_price: r.retail_price ? parseFloat(String(r.retail_price)) : null,
        quantity: r.quantity ? parseInt(String(r.quantity)) : 0,
        status: "in_stock",
      }));

    if (records.length === 0) continue;

    const { error } = await supabase.from("inventory").insert(records);
    if (error) {
      errors.push(`Batch error: ${error.message}`);
    } else {
      imported += records.length;
    }
  }

  return { imported, errors };
}
