"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format-currency";
import type { InventoryItem } from "../types";

interface AddStockItemModalProps {
  isOpen: boolean;
  inventory: InventoryItem[];
  currency: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (inventoryId: string) => void;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function AddStockItemModal({
  isOpen,
  inventory,
  currency,
  isPending,
  onClose,
  onSubmit,
}: AddStockItemModalProps) {
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit() {
    setFormError(null);
    if (!selectedInventoryId) {
      setFormError("Select an item");
      return;
    }
    onSubmit(selectedInventoryId);
    setSelectedInventoryId("");
  }

  function handleClose() {
    setFormError(null);
    setSelectedInventoryId("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-4">Add Stock Item</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Select Item</label>
            <select value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-700">
              <option value="">— Select inventory item —</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.sku}) — {fmt(item.retail_price, currency)}</option>
              ))}
            </select>
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleClose} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending} className="flex-1 bg-amber-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-amber-800 disabled:opacity-50">{isPending ? "Adding…" : "Add Item"}</button>
        </div>
      </div>
    </div>
  );
}
