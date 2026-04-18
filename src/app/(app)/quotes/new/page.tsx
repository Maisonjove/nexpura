import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import QuoteForm from "../QuoteForm";

export const metadata = {
  title: "New Quote | Nexpura",
};

export default async function NewQuotePage() {
  const [headersList, supabase] = await Promise.all([headers(), createClient()]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  // Fetch customers for the dropdown
  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .order("full_name");

  return (
    <div className="py-6">
      <QuoteForm
        tenantId={tenantId}
        customers={customers || []}
      />
    </div>
  );
}
