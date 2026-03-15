import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

const statusBadge: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  partially_paid: "bg-amber-100 text-amber-700",
  unpaid: "bg-red-100 text-red-600",
  sent: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  draft: "bg-stone-100 text-stone-500",
  voided: "bg-stone-100 text-stone-500",
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ReviewInvoicesPage() {
  const admin = createAdminClient();

  const { data: rawInvoices } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, status, due_date, total, amount_paid, customers(full_name)"
    )
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false });

  const invoices = (rawInvoices || []).map((inv) => ({
    ...inv,
    customers: Array.isArray(inv.customers) ? (inv.customers[0] ?? null) : inv.customers,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Invoices</h1>
        <p className="text-sm text-stone-400 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-widest">Total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-widest">Paid</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-stone-400">No invoices found</td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                  <td className="px-4 py-3 text-sm text-stone-700">
                    <Link href={`/review/invoices/${inv.id}`} className="font-medium text-stone-900 hover:text-amber-700 transition-colors">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    {(inv.customers as { full_name?: string } | null)?.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700 text-right">
                    {inv.total != null ? `$${Number(inv.total).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700 text-right">
                    {inv.amount_paid != null ? `$${Number(inv.amount_paid).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[inv.status] || "bg-stone-100 text-stone-600"}`}>
                      {formatStatus(inv.status || "—")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-GB") : "—"}
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
