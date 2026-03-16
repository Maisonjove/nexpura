import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

const stageBadge: Record<string, string> = {
  enquiry: "bg-stone-100 text-stone-600",
  concept: "bg-amber-50 text-amber-700",
  quoted: "bg-amber-100 text-amber-700",
  deposit_paid: "bg-green-100 text-green-700",
  cad: "bg-amber-50 text-amber-700",
  approval: "bg-amber-100 text-amber-700",
  stone_sourcing: "bg-stone-100 text-stone-600",
  casting: "bg-amber-50 text-amber-700",
  setting: "bg-amber-50 text-amber-700",
  finishing: "bg-amber-50 text-amber-700",
  quality_check: "bg-stone-100 text-stone-600",
  ready: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function formatStage(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ReviewBespokePage() {
  const admin = createAdminClient();

  const { data: rawJobs } = await admin
    .from("bespoke_jobs")
    .select(
      `id, job_number, title, stage, due_date, quoted_price, final_price, deposit_amount, created_at,
       customers(id, full_name)`
    )
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const jobs = (rawJobs || []).map((j) => ({
    ...j,
    customers: Array.isArray(j.customers) ? (j.customers[0] ?? null) : j.customers,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Bespoke Jobs</h1>
        <p className="text-sm text-stone-400 mt-0.5">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Job #</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Value</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-stone-400">No bespoke jobs found</td>
              </tr>
            ) : (
              jobs.map((j) => {
                const value = (j as { final_price?: number | null }).final_price
                  ?? (j as { quoted_price?: number | null }).quoted_price
                  ?? (j as { deposit_amount?: number | null }).deposit_amount
                  ?? null;
                return (
                  <tr key={j.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                    <td className="px-4 py-3 text-sm text-stone-700">
                      <Link href={`/review/bespoke/${j.id}`} className="font-medium text-stone-900 hover:text-amber-700 transition-colors">
                        {j.job_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-700">{j.title || "—"}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">
                      {(j.customers as { full_name?: string } | null)?.full_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge[j.stage] || "bg-stone-100 text-stone-600"}`}>
                        {formatStage(j.stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-700">
                      {j.due_date ? new Date(j.due_date).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-700">
                      {value != null ? `$${value.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
