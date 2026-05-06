"use client";

import { formatCurrency } from "@/lib/format-currency";
import type { InventoryItem } from "../types";

interface AddStockItemModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  formError: string | null;
  selectedInventoryId: string;
  setSelectedInventoryId: (v: string) => void;
  inventory: InventoryItem[];
  currency: string;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function AddStockItemModal({
  show,
  onClose,
  onSubmit,
  isPending,
  formError,
  selectedInventoryId,
  setSelectedInventoryId,
  inventory,
  currency,
}: AddStockItemModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-4">Add Stock Item</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Select Item</label>
            <select 
              value={selectedInventoryId} 
              onChange={e => setSelectedInventoryId(e.target.value)} 
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze"
            >
              <option value="">— Select inventory item —</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku}) — {fmt(item.retail_price, currency)}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
          <button onClick={onSubmit} disabled={isPending} className="flex-1 bg-nexpura-bronze text-white text-sm font-medium py-2.5 rounded-lg hover:bg-nexpura-bronze-hover disabled:opacity-50">
            {isPending ? "Adding…" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
