"use client";

import { useState } from "react";

interface AddManualItemModalProps {
  isOpen: boolean;
  currency: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: { description: string; qty: number; unitPrice: number }) => void;
}

export default function AddManualItemModal({
  isOpen,
  currency,
  isPending,
  onClose,
  onSubmit,
}: AddManualItemModalProps) {
  const [manualDesc, setManualDesc] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualPrice, setManualPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit() {
    setFormError(null);
    const qty = parseInt(manualQty) || 1;
    const price = parseFloat(manualPrice) || 0;
    const desc = manualDesc.trim();
    if (!desc) {
      setFormError("Description is required");
      return;
    }
    onSubmit({ description: desc, qty, unitPrice: price });
    setManualDesc("");
    setManualQty("1");
    setManualPrice("");
  }

  function handleClose() {
    setFormError(null);
    setManualDesc("");
    setManualQty("1");
    setManualPrice("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-4">Add Manual Line Item</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Description *</label>
            <input value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="e.g. Custom platinum band" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Quantity</label>
              <input type="number" value={manualQty} onChange={e => setManualQty(e.target.value)} min="1" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Unit Price ({currency})</label>
              <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="0.00" step="0.01" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-700" />
            </div>
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
