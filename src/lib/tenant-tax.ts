import { createAdminClient } from "@/lib/supabase/admin";

export interface TenantTaxConfig {
  tax_rate: number;
  tax_name: string;
  tax_inclusive: boolean;
}

/**
 * Fetch tax configuration for a tenant from the tenants table.
 * Defaults: tax_rate=0.1 (10% GST), tax_name="GST", tax_inclusive=true
 */
export async function getTenantTaxConfig(tenantId: string): Promise<TenantTaxConfig> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("tax_rate, tax_name, tax_inclusive")
    .eq("id", tenantId)
    .single();

  return {
    tax_rate: data?.tax_rate ?? 0.1,
    tax_name: data?.tax_name || "GST",
    tax_inclusive: data?.tax_inclusive ?? true,
  };
}
