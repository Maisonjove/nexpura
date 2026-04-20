import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";


function fmt(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 }).format(v);
}

const statusBadge: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-amber-100 text-amber-700",
  issued: "bg-green-100 text-green-700",
};

export default async function ReviewAppraisalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: a } = await admin
    .from("appraisals")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();

  if (!a) notFound();

  const statusClass = statusBadge[a.status] ?? "bg-stone-100 text-stone-600";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/review/appraisals" className="text-xs text-stone-400 hover:text-amber-700 transition-colors">← All Appraisals</Link>
          <h1 className="text-2xl font-semibold text-stone-900 mt-1">{a.appraisal_number ?? "Appraisal"}</h1>
          <p className="text-sm text-stone-500 mt-0.5">{a.purpose}</p>
        </div>
        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${statusClass}`}>
          {a.status.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Client */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Client</h2>
          <p className="text-base font-semibold text-stone-900">{a.customer_name}</p>
          {a.customer_email && <p className="text-sm text-stone-500">{a.customer_email}</p>}
          {a.customer_phone && <p className="text-sm text-stone-500">{a.customer_phone}</p>}
          {a.customer_address && <p className="text-sm text-stone-400">{a.customer_address}</p>}
        </div>

        {/* Appraisal dates */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Certificate Details</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-stone-400">Type</p><p className="font-medium text-stone-800 capitalize">{a.appraisal_type}</p></div>
            <div><p className="text-stone-400">Date</p><p className="font-medium text-stone-800">{a.appraisal_date ? new Date(a.appraisal_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}</p></div>
            <div><p className="text-stone-400">Valid Until</p><p className="font-medium text-stone-800">{a.valid_until ? new Date(a.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}</p></div>
            <div><p className="text-stone-400">Fee</p><p className="font-medium text-stone-800">{fmt(a.fee)}</p></div>
          </div>
        </div>
      </div>

      {/* Item Details */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Item Details</h2>
        <div>
          <p className="text-base font-semibold text-stone-900">{a.item_name}</p>
          {a.item_description && <p className="text-sm text-stone-500 mt-1">{a.item_description}</p>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {a.metal && <div><p className="text-stone-400">Metal</p><p className="font-medium text-stone-800">{a.metal}{a.metal_purity ? ` · ${a.metal_purity}` : ""}</p></div>}
          {a.metal_weight_grams && <div><p className="text-stone-400">Weight</p><p className="font-medium text-stone-800">{a.metal_weight_grams}g</p></div>}
          {a.stone && <div><p className="text-stone-400">Stone</p><p className="font-medium text-stone-800">{a.stone}</p></div>}
          {a.stone_carat && <div><p className="text-stone-400">Carat Weight</p><p className="font-medium text-stone-800">{a.stone_carat}ct</p></div>}
          {a.stone_colour && <div><p className="text-stone-400">Colour</p><p className="font-medium text-stone-800">{a.stone_colour}</p></div>}
          {a.stone_clarity && <div><p className="text-stone-400">Clarity</p><p className="font-medium text-stone-800">{a.stone_clarity}</p></div>}
          {a.stone_cut && <div><p className="text-stone-400">Cut</p><p className="font-medium text-stone-800">{a.stone_cut}</p></div>}
          {a.stone_certificate_number && <div><p className="text-stone-400">Cert No.</p><p className="font-medium text-stone-800 font-mono text-xs">{a.stone_certificate_number}</p></div>}
          {a.condition && <div><p className="text-stone-400">Condition</p><p className="font-medium text-stone-800 capitalize">{a.condition}</p></div>}
          {a.hallmarks && <div><p className="text-stone-400">Hallmarks</p><p className="font-medium text-stone-800">{a.hallmarks}</p></div>}
          {a.age_period && <div><p className="text-stone-400">Period</p><p className="font-medium text-stone-800">{a.age_period}</p></div>}
          {a.provenance && <div className="col-span-2"><p className="text-stone-400">Provenance</p><p className="font-medium text-stone-800">{a.provenance}</p></div>}
        </div>
      </div>

      {/* Valuations */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Valuation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Appraised Value", value: a.appraised_value, highlight: false },
            { label: "Replacement Value", value: a.replacement_value, highlight: false },
            { label: "Insurance Value", value: a.insurance_value, highlight: true },
            { label: "Market Value", value: a.market_value, highlight: false },
          ].map(({ label, value, highlight }) => (
            <div key={label} className={`rounded-lg p-4 ${highlight ? "bg-amber-50 border border-amber-200" : "bg-stone-50"}`}>
              <p className="text-xs text-stone-400">{label}</p>
              <p className={`text-xl font-bold mt-1 ${highlight ? "text-amber-800" : "text-stone-900"}`}>{fmt(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Appraiser */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Appraiser</h2>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <div>
            <p className="font-semibold text-stone-900">{a.appraiser_name}</p>
            {a.appraiser_qualifications && <p className="text-sm text-stone-500">{a.appraiser_qualifications}</p>}
            {a.appraiser_licence && <p className="text-xs text-stone-400 mt-0.5">Licence: {a.appraiser_licence}</p>}
          </div>
        </div>
        {a.methodology && (
          <div className="mt-2 text-sm text-stone-600 bg-stone-50 rounded-lg p-3">
            <span className="font-medium text-stone-700">Methodology: </span>{a.methodology}
          </div>
        )}
        {a.notes && (
          <div className="text-sm text-stone-600 bg-stone-50 rounded-lg p-3">
            <span className="font-medium text-stone-700">Notes: </span>{a.notes}
          </div>
        )}
      </div>
    </div>
  );
}
