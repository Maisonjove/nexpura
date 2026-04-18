import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import Link from "next/link";
import CustomerForm from "../../CustomerForm";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, headersList, supabase] = await Promise.all([
    params,
    headers(),
    createClient(),
  ]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (!customer) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/customers/${id}`}
          className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:border-stone-900/30 hover:text-stone-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-semibold text-2xl font-semibold text-stone-900">Edit Customer</h1>
          <p className="text-stone-500 mt-0.5 text-sm">{customer.full_name}</p>
        </div>
      </div>

      <CustomerForm mode="edit" customer={customer} />
    </div>
  );
}
