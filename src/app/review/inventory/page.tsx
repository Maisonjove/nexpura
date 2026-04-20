import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";


const statusBadge: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-stone-100 text-stone-500",
  discontinued: "bg-red-100 text-red-600",
  out_of_stock: "bg-red-100 text-red-600",
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ReviewInventoryPage() {
  const admin = createAdminClient();

  const { data: items } = await admin
    .from("inventory")
    .select(
      "id, sku, name, item_type, metal_type, stone_type, stone_carat, quantity, retail_price, status"
    )
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const safeItems = items || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Inventory</h1>
        <p className="text-sm text-stone-400 mt-0.5">{safeItems.length} item{safeItems.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Metal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Stone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Carat</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-widest">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-widest">Price</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {safeItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-stone-400">No inventory items found</td>
              </tr>
            ) : (
              safeItems.map((item) => (
                <tr key={item.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                  <td className="px-4 py-3 text-sm text-stone-500 font-mono">{item.sku || "—"}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    <Link href={`/review/inventory/${item.id}`} className="font-medium text-stone-900 hover:text-amber-700 transition-colors">
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700 capitalize">{item.item_type || "—"}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">{item.metal_type || "—"}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">{item.stone_type || "—"}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    {item.stone_carat != null ? `${item.stone_carat}ct` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-stone-700 text-right">
                    {item.retail_price != null ? `$${Number(item.retail_price).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[item.status] || "bg-stone-100 text-stone-600"}`}>
                      {formatStatus(item.status || "active")}
                    </span>
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
