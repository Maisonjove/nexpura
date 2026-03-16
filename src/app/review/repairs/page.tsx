import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

const stageBadge: Record<string, string> = {
  intake: "bg-stone-100 text-stone-600",
  assessed: "bg-amber-50 text-amber-700",
  quoted: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  in_progress: "bg-amber-50 text-amber-700",
  quality_check: "bg-stone-100 text-stone-600",
  ready: "bg-green-100 text-green-700",
  collected: "bg-stone-100 text-stone-600",
  cancelled: "bg-red-100 text-red-700",
};

function formatStage(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ReviewRepairsPage() {
  const admin = createAdminClient();

  const { data: rawRepairs } = await admin
    .from("repairs")
    .select(
      `id, repair_number, item_description, stage, due_date, created_at,
       customers(id, full_name)`
    )
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const repairs = (rawRepairs || []).map((r) => ({
    ...r,
    customers: Array.isArray(r.customers) ? (r.customers[0] ?? null) : r.customers,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Repairs</h1>
        <p className="text-sm text-stone-400 mt-0.5">{repairs.length} repair{repairs.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Repair #</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Item</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {repairs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-stone-400">No repairs found</td>
              </tr>
            ) : (
              repairs.map((r) => (
                <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                  <td className="px-4 py-3 text-sm text-stone-700">
                    <Link href={`/review/repairs/${r.id}`} className="font-medium text-stone-900 hover:text-amber-700 transition-colors">
                      {r.repair_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    {(r.customers as { full_name?: string } | null)?.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700 max-w-xs truncate">
                    {r.item_description || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge[r.stage] || "bg-stone-100 text-stone-600"}`}>
                      {formatStage(r.stage)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    {r.due_date ? new Date(r.due_date).toLocaleDateString("en-GB") : "—"}
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
