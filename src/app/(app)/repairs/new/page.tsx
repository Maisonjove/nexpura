import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import RepairForm from "../RepairForm";

export default async function NewRepairPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string }>;
}) {
  const [{ customer_id }, headersList, supabase] = await Promise.all([
    searchParams,
    headers(),
    createClient(),
  ]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <a
          href="/repairs"
          className="text-sm text-stone-500 hover:text-amber-700 transition-colors"
        >
          ← Repairs
        </a>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900 mt-2">
          New Repair
        </h1>
      </div>
      <RepairForm
        customers={customers || []}
        mode="create"
        preselectedCustomerId={customer_id}
      />
    </div>
  );
}
