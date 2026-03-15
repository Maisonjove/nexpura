import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SaleForm from "../SaleForm";

export default async function NewSalePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, tenants(tax_rate, tax_name, currency)")
    .eq("id", user.id)
    .single();

  const tenant = userData?.tenants as { tax_rate?: number; tax_name?: string; currency?: string } | null;
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
