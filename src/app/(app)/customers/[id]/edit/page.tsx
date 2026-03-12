import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import CustomerForm from "../../CustomerForm";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData?.tenant_id ?? "")
    .is("deleted_at", null)
    .single();

  if (!customer) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/customers/${id}`}
          className="w-8 h-8 rounded-lg border border-platinum flex items-center justify-center text-forest/50 hover:border-forest/30 hover:text-forest transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-fraunces text-2xl font-semibold text-forest">Edit Customer</h1>
          <p className="text-forest/60 mt-0.5 text-sm">{customer.full_name}</p>
        </div>
      </div>

      <CustomerForm mode="edit" customer={customer} />
    </div>
  );
}
