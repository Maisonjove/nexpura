import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import Link from "next/link";

export const metadata = { title: "Stock Movement — Nexpura" };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function StockMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string }>;
}) {
  const params = await searchParams;
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

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;
  const typeFilter = params.type ?? "all";

  const admin = createAdminClient();

  // Fetch activity logs for stock-related events
  let stockEvents: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }> = [];

  try {
    let query = admin
      .from("activity_log")
      .select("id, action, entity_type, entity_id, user_id, created_at, metadata")
      .eq("tenant_id", tenantId)
      .in("action", ["stock_in", "stock_out", "stock_adjust", "receive_stock", "inventory_created", "stock_received"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (from) query = query.gte("created_at", from + "T00:00:00");
    if (to) query = query.lte("created_at", to + "T23:59:59");

    const { data } = await query;
    stockEvents = (data ?? []) as typeof stockEvents;
  } catch {
    // table may not exist or no events
  }

  // Also fetch purchase order receipts as stock-in events
  let poReceipts: Array<{
    id: string;
    po_number?: string;
    received_at: string;
    supplier_id: string | null;
    items?: Array<{ quantity_received: number; inventory_id?: string }>;
  }> = [];
  try {
    const { data } = await admin
      .from("purchase_orders")
      .select("id, po_number, received_at, supplier_id")
      .eq("tenant_id", tenantId)
      .eq("status", "received")
      .gte("received_at", from + "T00:00:00")
      .lte("received_at", to + "T23:59:59")
      .order("received_at", { ascending: false });
    poReceipts = data ?? [];
  } catch {
    // ignore
  }

  const totalStockIn = stockEvents.filter((e) => ["stock_in", "stock_received", "receive_stock", "inventory_created"].includes(e.action)).length + poReceipts.length;
  const totalStockOut = stockEvents.filter((e) => e.action === "stock_out").length;
  const totalAdjustments = stockEvents.filter((e) => e.action === "stock_adjust").length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-stone-400 mb-1">
            <Link href="/reports" className="hover:text-amber-700">Reports</Link>
            <span>/</span>
            <span className="text-stone-600">Stock Movement</span>
          </div>
          <h1 className="font-semibold text-2xl text-stone-900">Stock Movement Report</h1>
          <p className="text-stone-500 mt-1 text-sm">Track stock in, out, and adjustments over time</p>
        </div>
        <Link href="/inventory/receive" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700 transition-colors">
          Receive Stock →
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-end gap-4 shadow-sm">
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">From</label>
          <input name="from" type="date" defaultValue={from}
            className="h-9 rounded-md border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-nexpura-bronze" />
        </div>
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">To</label>
          <input name="to" type="date" defaultValue={to}
            className="h-9 rounded-md border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-nexpura-bronze" />
        </div>
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">Type</label>
          <select name="type" defaultValue={typeFilter}
            className="h-9 rounded-md border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-nexpura-bronze">
            <option value="all">All Movements</option>
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="adjust">Adjustments</option>
          </select>
        </div>
        <button type="submit" className="h-9 px-4 rounded-md bg-nexpura-charcoal text-white text-sm hover:bg-nexpura-charcoal-700 transition-colors">
          Apply
        </button>
      </form>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Stock In", value: totalStockIn, color: "text-green-600", bg: "bg-green-50" },
          { label: "Stock Out", value: totalStockOut, color: "text-red-500", bg: "bg-red-50" },
          { label: "Adjustments", value: totalAdjustments, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-stone-500 uppercase tracking-wider font-medium mb-2">{c.label}</p>
            <p className={`text-2xl font-semibold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* PO Receipts */}
      {poReceipts.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <h2 className="font-semibold text-stone-900">Purchase Order Receipts (Stock In)</h2>
            <span className="ml-auto text-sm text-stone-400">{poReceipts.length} receipts</span>
          </div>
          <div className="divide-y divide-stone-100">
            {poReceipts.map((po) => (
              <div key={po.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-stone-900">{po.po_number ?? `PO-${po.id.slice(0, 8)}`}</p>
                  <p className="text-xs text-stone-400">{po.received_at ? fmtDate(po.received_at) : "—"}</p>
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Stock In</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log Events */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200">
          <h2 className="font-semibold text-stone-900">Stock Activity Log</h2>
        </div>
        {stockEvents.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-stone-400">
            No stock movements found for this period.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {stockEvents.map((e) => {
              const isIn = ["stock_in", "stock_received", "receive_stock", "inventory_created"].includes(e.action);
              const isOut = e.action === "stock_out";
              return (
                <div key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-medium text-stone-900 capitalize">{e.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-stone-400">{fmtDate(e.created_at)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isIn ? "text-green-600 bg-green-50" :
                    isOut ? "text-red-600 bg-red-50" :
                    "text-amber-600 bg-amber-50"
                  }`}>
                    {isIn ? "Stock In" : isOut ? "Stock Out" : "Adjustment"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
