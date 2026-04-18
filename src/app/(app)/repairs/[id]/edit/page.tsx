import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import Link from "next/link";
import RepairForm from "../../RepairForm";

export default async function EditRepairPage({
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

  const [{ data: repair }, { data: customers }] = await Promise.all([
    supabase
      .from("repairs")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("customers")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
  ]);

  if (!repair) notFound();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/repairs/${id}`}
          className="text-sm text-stone-500 hover:text-amber-700 transition-colors"
        >
          ← Back to Repair
        </Link>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900 mt-2">
          Edit Repair
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          {repair.repair_number} — {repair.item_type}
        </p>
      </div>
      <RepairForm
        customers={customers || []}
        mode="edit"
        repair={repair}
      />
    </div>
  );
}
