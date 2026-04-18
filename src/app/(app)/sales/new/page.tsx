import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import SaleForm from "../SaleForm";

export default async function NewSalePage() {
  const [headersList, supabase] = await Promise.all([headers(), createClient()]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("tax_rate, tax_name, currency")
    .eq("id", tenantId)
    .single();

  const taxRate = tenant?.tax_rate ?? 0.1;
  const taxName = tenant?.tax_name || "GST";
  const currency = tenant?.currency || "AUD";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">New Sale</h1>
        <p className="text-stone-500 mt-1 text-sm">Create a new sales transaction.</p>
      </div>
      <SaleForm taxRate={taxRate} taxName={taxName} currency={currency} />
    </div>
  );
}
