import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import BespokeJobForm from "../../BespokeJobForm";

export default async function EditBespokeJobPage({
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

  const { data: job } = await supabase
    .from("bespoke_jobs")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!job) notFound();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href={`/bespoke/${id}`} className="text-sm text-stone-500 hover:text-amber-700 transition-colors">
          ← {job.job_number}
        </Link>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900 mt-2">Edit Job</h1>

        {/* Read-only header */}
        <div className="mt-3 flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-3">
          <span className="text-xs font-mono text-stone-400">Job Number</span>
          <span className="text-sm font-mono font-medium text-stone-900">{job.job_number}</span>
          <span className="mx-2 text-stone-300">·</span>
          <span className="text-xs text-stone-400">Customer cannot be changed after creation</span>
        </div>
      </div>

      <BespokeJobForm
        customers={customers || []}
        mode="edit"
        job={{
          id: job.id,
          job_number: job.job_number,
          customer_id: job.customer_id,
          title: job.title,
          jewellery_type: job.jewellery_type,
          order_type: job.order_type,
          metal_type: job.metal_type,
          metal_colour: job.metal_colour,
          metal_purity: job.metal_purity,
          metal_weight_grams: job.metal_weight_grams,
          stone_type: job.stone_type,
          stone_shape: job.stone_shape,
          stone_carat: job.stone_carat,
          stone_colour: job.stone_colour,
          stone_clarity: job.stone_clarity,
          stone_origin: job.stone_origin,
          stone_cert_number: job.stone_cert_number,
          ring_size: job.ring_size,
          setting_style: job.setting_style,
          priority: job.priority,
          due_date: job.due_date,
          deposit_due_date: job.deposit_due_date,
          quoted_price: job.quoted_price,
          deposit_amount: job.deposit_amount,
          deposit_received: job.deposit_received,
          final_price: job.final_price,
          description: job.description,
          internal_notes: job.internal_notes,
          client_notes: job.client_notes,
        }}
      />
    </div>
  );
}
