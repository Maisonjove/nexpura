"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export default function TransfersClient({ tenantId, initialTransfers, locations, inventory }: any) {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const [form, setForm] = useState({
    from_location_id: "",
    to_location_id: "",
    notes: "",
    items: [{ inventory_id: "", quantity: 1 }]
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const { data: transfer, error: tErr } = await supabase
      .from("stock_transfers")
      .insert([{
        tenant_id: tenantId,
        from_location_id: form.from_location_id || null,
        to_location_id: form.to_location_id || null,
        notes: form.notes,
        status: "completed" // Auto-complete for now
      }])
      .select()
      .single();

    if (transfer) {
      const items = form.items.filter(i => i.inventory_id).map(i => ({
        transfer_id: transfer.id,
        inventory_id: i.inventory_id,
        quantity: i.quantity
      }));

      await supabase.from("stock_transfer_items").insert(items);
      
      // Update inventory locations
      for (const item of items) {
        await supabase
          .from("inventory")
          .update({ location_id: transfer.to_location_id })
          .eq("id", item.inventory_id);
      }

      setTransfers([transfer, ...transfers]);
      setShowNew(false);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            Stock Transfers
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 mt-1">BETA</span>
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">Move items between locations and track history. <span className="italic">Note: Advanced multi-store allocation is in Beta.</span></p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347]"
        >
          + New Transfer
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase mb-1">From Location</label>
                <select
                  required
                  value={form.from_location_id}
                  onChange={e => setForm({ ...form, from_location_id: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg outline-none bg-white"
                >
                  <option value="">Select Origin</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase mb-1">To Location</label>
                <select
                  required
                  value={form.to_location_id}
                  onChange={e => setForm({ ...form, to_location_id: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg outline-none bg-white"
                >
                  <option value="">Select Destination</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-stone-500 uppercase">Items to Transfer</label>
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    required
                    value={item.inventory_id}
                    onChange={e => {
                      const newItems = [...form.items];
                      newItems[idx].inventory_id = e.target.value;
                      setForm({ ...form, items: newItems });
                    }}
                    className="flex-1 px-3 py-2 border border-stone-200 rounded-lg outline-none bg-white"
                  >
                    <option value="">Select Item</option>
                    {inventory.map((i: any) => <option key={i.id} value={i.id}>{i.sku ? `[${i.sku}] ` : ""}{i.name}</option>)}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => {
                      const newItems = [...form.items];
                      newItems[idx].quantity = parseInt(e.target.value);
                      setForm({ ...form, items: newItems });
                    }}
                    className="w-24 px-3 py-2 border border-stone-200 rounded-lg outline-none"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, items: [...form.items, { inventory_id: "", quantity: 1 }] })}
                className="text-xs text-[#8B7355] font-medium hover:underline"
              >
                + Add Another Item
              </button>
            </div>

            <textarea
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg outline-none h-20 resize-none"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-stone-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                Confirm Transfer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">Date</th>
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">From</th>
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">To</th>
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {transfers.map((t: any) => (
              <tr key={t.id} className="text-sm">
                <td className="px-6 py-4 text-stone-600">{format(new Date(t.created_at), "dd MMM yyyy")}</td>
                <td className="px-6 py-4 font-medium">{t.from?.name || "Multiple/Various"}</td>
                <td className="px-6 py-4 font-medium">{t.to?.name || "Unknown"}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                    {t.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-stone-500 italic">{t.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
