import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import Link from "next/link";

export const metadata = { title: "Supplier Reports — Nexpura" };

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function SupplierReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminForUser = createAdminClient();
  const { data: userData } = await adminForUser.from("users").select("tenant_id").eq("id", user.id).single();
  const tenantId = userData?.tenant_id ?? "";
  if (!tenantId) redirect("/onboarding");

  const allowed = await hasPermission(user.id, tenantId, "access_reports");
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to access Reports.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  // Fetch suppliers
  const { data: suppliers } = await admin
    .from("suppliers")
    .select("id, name, email, phone, payment_terms")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name");

  // Fetch all purchase orders for this tenant
  const { data: orders } = await admin
    .from("purchase_orders")
    .select("id, supplier_id, status, total_cost, created_at, updated_at, expected_delivery_date, received_at")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  // Fetch outstanding invoices by supplier
  const { data: invoiceItems } = await admin
    .from("invoice_items")
    .select("amount, invoices!inner(tenant_id, supplier_id, status)")
    .eq("invoices.tenant_id", tenantId)
    .in("invoices.status", ["unpaid", "partial", "overdue", "draft"])
    .not("invoices.supplier_id", "is", null)
    .limit(500);

  // Build supplier stats
  type SupplierStat = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    paymentTerms: string | null;
    orderCount: number;
    totalSpend: number;
    avgDeliveryDays: number | null;
    lastOrderDate: string | null;
    returnRate: number;
    outstandingAmount: number;
  };

  const supplierStats: SupplierStat[] = (suppliers ?? []).map((s) => {
    const supplierOrders = (orders ?? []).filter((o) => o.supplier_id === s.id);
    const totalSpend = supplierOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0);

    // Calc avg delivery days for received orders
    const deliveredOrders = supplierOrders.filter((o) => o.status === "received" && o.received_at && o.created_at);
    const avgDelivery = deliveredOrders.length > 0
      ? Math.round(
          deliveredOrders.reduce((sum, o) => {
            const diff = (new Date(o.received_at!).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return sum + diff;
          }, 0) / deliveredOrders.length
        )
      : null;

    const lastOrder = supplierOrders.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

    // Outstanding invoices
    const outstanding = (invoiceItems ?? [])
      .filter((ii) => {
        const inv = Array.isArray(ii.invoices) ? ii.invoices[0] : ii.invoices;
        return inv && (inv as { supplier_id?: string }).supplier_id === s.id;
      })
      .reduce((sum, ii) => sum + (ii.amount || 0), 0);

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      paymentTerms: s.payment_terms,
      orderCount: supplierOrders.length,
      totalSpend,
      avgDeliveryDays: avgDelivery,
      lastOrderDate: lastOrder?.created_at ?? null,
      returnRate: 0, // Would need returns tracking table
      outstandingAmount: outstanding,
    };
  });

  // Sort by total spend
  supplierStats.sort((a, b) => b.totalSpend - a.totalSpend);

  const totalSuppliers = supplierStats.length;
  const totalOrders = (orders ?? []).length;
  const totalSpendAllTime = supplierStats.reduce((s, sup) => s + sup.totalSpend, 0);
  const totalOutstanding = supplierStats.reduce((s, sup) => s + sup.outstandingAmount, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-stone-400 mb-1">
            <Link href="/reports" className="hover:text-amber-700">Reports</Link>
            <span>/</span>
            <span className="text-stone-600">Suppliers</span>
          </div>
          <h1 className="font-semibold text-2xl text-stone-900">Supplier Performance</h1>
          <p className="text-stone-500 mt-1 text-sm">Order history, spend, and delivery metrics per supplier</p>
        </div>
        <Link href="/suppliers" className="text-sm text-amber-700 hover:underline font-medium">
          Manage Suppliers →
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Suppliers", value: String(totalSuppliers) },
          { label: "Total Orders", value: String(totalOrders) },
          { label: "All-Time Spend", value: fmtCurrency(totalSpendAllTime) },
          { label: "Outstanding Invoices", value: fmtCurrency(totalOutstanding), urgent: totalOutstanding > 0 },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-stone-500 uppercase tracking-wider font-medium mb-2">{card.label}</p>
            <p className={`text-2xl font-semibold ${card.urgent ? "text-amber-600" : "text-stone-900"}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Supplier Performance Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-stone-900">Supplier Performance</h2>
        </div>
        {supplierStats.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-stone-400">
            No suppliers yet. <Link href="/suppliers/new" className="text-amber-700 hover:underline">Add a supplier →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider">Payment Terms</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider">Orders</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider">Total Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider">Avg Delivery</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider">Last Order</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wider">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {supplierStats.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50/50">
                    <td className="px-5 py-3">
                      <Link href={`/suppliers/${s.id}`} className="font-medium text-stone-900 hover:text-amber-700">
                        {s.name}
                      </Link>
                      {s.email && <p className="text-xs text-stone-400">{s.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-xs">
                      {s.paymentTerms ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-stone-100 text-stone-700 rounded-full font-medium uppercase tracking-wide">
                          {s.paymentTerms}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900">{s.orderCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900">{fmtCurrency(s.totalSpend)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">
                      {s.avgDeliveryDays !== null ? `${s.avgDeliveryDays} days` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-500">{fmtDate(s.lastOrderDate)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.outstandingAmount > 0 ? (
                        <span className="text-amber-600 font-medium">{fmtCurrency(s.outstandingAmount)}</span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Status by Supplier */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-stone-900">Outstanding Invoices by Supplier</h2>
        </div>
        {supplierStats.filter((s) => s.outstandingAmount > 0).length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-stone-400">All supplier invoices are settled ✓</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {supplierStats.filter((s) => s.outstandingAmount > 0).map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-stone-900">{s.name}</p>
                  <p className="text-xs text-stone-400">{s.orderCount} orders total</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-amber-600">{fmtCurrency(s.outstandingAmount)}</p>
                  <p className="text-xs text-stone-400">outstanding</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
