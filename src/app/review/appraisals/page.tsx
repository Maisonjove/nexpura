import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const statusBadge: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-amber-100 text-amber-700",
  issued: "bg-green-100 text-green-700",
};

const typeLabel: Record<string, string> = {
  insurance: "Insurance",
  estate: "Estate",
  retail: "Retail",
  wholesale: "Wholesale",
  damage: "Damage",
  other: "Other",
};

function fmt(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 }).format(v);
}

export default async function ReviewAppraisalsPage() {
  const admin = createAdminClient();

  const { data: raw } = await admin
    .from("appraisals")
    .select("id, appraisal_number, appraisal_type, status, customer_name, item_name, appraised_value, insurance_value, appraisal_date, valid_until, fee")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false });

  const appraisals = raw ?? [];

  const totalIssued = appraisals.filter((a) => a.status === "issued").length;
  const totalInsuranceValue = appraisals
    .filter((a) => a.status === "issued")
    .reduce((s, a) => s + (a.insurance_value ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Appraisals & Valuations</h1>
        <p className="text-sm text-stone-400 mt-0.5">{appraisals.length} appraisal{appraisals.length !== 1 ? "s" : ""}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Total</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{appraisals.length}</p>
          <p className="text-xs text-stone-400 mt-0.5">appraisals on record</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Issued</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{totalIssued}</p>
          <p className="text-xs text-stone-400 mt-0.5">certificates issued</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Total Insured Value</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{fmt(totalInsuranceValue)}</p>
          <p className="text-xs text-stone-400 mt-0.5">across issued certificates</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Ref</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Item</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Appraised Value</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Valid Until</th>
            </tr>
          </thead>
          <tbody>
            {appraisals.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-stone-400">No appraisals found</td>
              </tr>
            ) : (
              appraisals.map((a) => (
                <tr key={a.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/review/appraisals/${a.id}`} className="font-mono font-semibold text-stone-900 hover:text-amber-700 transition-colors">
                      {a.appraisal_number || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">{a.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-stone-700 max-w-xs truncate">{a.item_name}</td>
                  <td className="px-4 py-3 text-sm text-stone-500">{typeLabel[a.appraisal_type] ?? a.appraisal_type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[a.status] ?? "bg-stone-100 text-stone-600"}`}>
                      {a.status.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-stone-900">{fmt(a.appraised_value)}</td>
                  <td className="px-4 py-3 text-sm text-stone-500">
                    {a.appraisal_date ? new Date(a.appraisal_date).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-500">
                    {a.valid_until ? new Date(a.valid_until).toLocaleDateString("en-GB") : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
