"use server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";

/**
 * Fast tenant ID resolution from middleware-set headers.
 * Eliminates supabase.auth.getUser() + DB query (~70-150ms savings per call).
 */
async function getTenantId(): Promise<string> {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) throw new Error("Not authenticated");
  return tenantId;
}

export interface SaleWithLocation {
  id: string;
  sale_number: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  payment_method: string | null;
  total: number;
  amount_paid: number | null;
  sale_date: string;
  created_at: string;
  location_id: string | null;
  locationName?: string;
}

export async function getSales(locationIds: string[] | null): Promise<SaleWithLocation[]> {
  const tenantId = await getTenantId();
  const admin = createAdminClient();

  // Determine if we need location names (when showing multiple locations)
  const showLocationNames = !locationIds || locationIds.length > 1;
  const locationMap: Map<string, string> = new Map();

  if (showLocationNames) {
    const { data: locations } = await admin
      .from("locations")
      .select("id, name")
      .eq("tenant_id", tenantId);
    for (const loc of locations ?? []) {
      locationMap.set(loc.id, loc.name);
    }
  }

  // Build query
  let query = admin
    .from("sales")
    .select("id, sale_number, customer_name, customer_email, status, payment_method, total, amount_paid, sale_date, created_at, location_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  // Apply location filter
  if (locationIds && locationIds.length > 0) {
    if (locationIds.length === 1) {
      query = query.eq("location_id", locationIds[0]);
    } else {
      query = query.in("location_id", locationIds);
    }
  }

  const { data: sales } = await query;

  return (sales ?? []).map((sale) => ({
    ...sale,
    locationName:
      showLocationNames && sale.location_id
        ? locationMap.get(sale.location_id)
        : undefined,
  }));
}
