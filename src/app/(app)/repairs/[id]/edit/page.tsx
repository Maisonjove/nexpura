import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import RepairForm from "../../RepairForm";

export default async function EditRepairPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  const { data: repair } = await supabase
    .from("repairs")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!repair) notFound();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/repairs/${id}`}
          className="text-sm text-stone-500 hover:text-[#8B7355] transition-colors"
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
