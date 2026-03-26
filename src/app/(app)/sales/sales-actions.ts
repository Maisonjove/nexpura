"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return { tenantId: userData.tenant_id as string };
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
  const { tenantId } = await getAuthContext();
  const admin = createAdminClient();

  // Determine if we need location names (when showing multiple locations)
  const showLocationNames = !locationIds || locationIds.length > 1;
  let locationMap: Map<string, string> = new Map();
  
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
    locationName: showLocationNames && sale.location_id ? locationMap.get(sale.location_id) : undefined,
  }));
}
