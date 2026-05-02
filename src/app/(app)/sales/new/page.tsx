import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import SaleForm from "../SaleForm";

export default function NewSalePage() {
  return (
    <Suspense fallback={null}>
      <NewSaleBody />
    </Suspense>
  );
}

async function NewSaleBody() {
  const [headersList, supabase] = await Promise.all([headers(), createClient()]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const [tenantResult, inventoryResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("tax_rate, tax_name, currency")
      .eq("id", tenantId)
      .single(),
    supabase
      .from("inventory")
      .select("id, name, sku, retail_price, quantity")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(500),
  ]);

  const taxRate = tenantResult.data?.tax_rate ?? 0.1;
  const taxName = tenantResult.data?.tax_name || "GST";
  const currency = tenantResult.data?.currency || "AUD";
  const inventory = (inventoryResult.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    retail_price: Number(i.retail_price ?? 0),
    quantity: Number(i.quantity ?? 0),
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">New Sale</h1>
        <p className="text-stone-500 mt-1 text-sm">Create a new sales transaction.</p>
      </div>
      <SaleForm taxRate={taxRate} taxName={taxName} currency={currency} inventory={inventory} />
    </div>
  );
}
