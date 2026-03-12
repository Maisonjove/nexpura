"use client";

import { useState, useTransition } from "react";
import { adjustStock } from "../actions";

interface StockAdjustModalProps {
  inventoryId: string;
  currentQty: number;
  onClose: () => void;
}

const MOVEMENT_TYPES = [
  { value: "purchase", label: "Purchase (stock in)" },
  { value: "adjustment", label: "Adjustment (manual)" },
  { value: "return", label: "Customer Return" },
  { value: "damage", label: "Damage / Loss" },
  { value: "transfer", label: "Transfer" },
];

export default function StockAdjustModal({ inventoryId, currentQty, onClose }: StockAdjustModalProps) {
  const [movementType, setMovementType] = useState("adjustment");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const quantityChange = quantity ? (direction === "add" ? parseInt(quantity) : -parseInt(quantity)) : 0;
  const newQty = currentQty + quantityChange;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || parseInt(quantity) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await adjustStock(inventoryId, movementType, quantityChange, notes);
        onClose();
      } catch (err) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          setError(err.message);
        } else {
          onClose();
        }
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-platinum shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-platinum">
          <h2 className="font-fraunces text-lg font-semibold text-forest">Adjust Stock</h2>
          <button onClick={onClose} className="text-forest/40 hover:text-forest transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-forest mb-1">Movement Type</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-platinum rounded-lg bg-white text-forest focus:outline-none focus:border-sage transition-colors"
            >
              {MOVEMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-forest mb-2">Direction</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDirection("add")}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  direction === "add" ? "bg-green-50 text-green-700 border-green-300" : "bg-white text-forest/60 border-platinum hover:border-sage/50"
                }`}
              >
                + Add Stock
              </button>
              <button
                type="button"
                onClick={() => setDirection("remove")}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  direction === "remove" ? "bg-red-50 text-red-700 border-red-300" : "bg-white text-forest/60 border-platinum hover:border-sage/50"
                }`}
              >
                − Remove Stock
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-forest mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              className="w-full px-3 py-2.5 text-sm border border-platinum rounded-lg bg-white text-forest placeholder:text-forest/30 focus:outline-none focus:border-sage transition-colors"
            />
          </div>

          {/* Preview */}
          {quantity && parseInt(quantity) > 0 && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm ${
              newQty < 0 ? "bg-red-50 border-red-200" : "bg-sage/5 border-sage/20"
            }`}>
              <span className="text-forest/60">New stock level</span>
              <span className={`font-semibold font-fraunces text-lg ${newQty < 0 ? "text-red-600" : "text-forest"}`}>
                {currentQty} → {newQty < 0 ? <span className="text-red-600">Invalid</span> : newQty}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-forest mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm border border-platinum rounded-lg bg-white text-forest placeholder:text-forest/30 focus:outline-none focus:border-sage transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-forest border border-forest rounded-lg hover:bg-forest hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !quantity || parseInt(quantity) <= 0 || newQty < 0}
              className="flex-1 py-2.5 text-sm font-medium bg-sage text-white rounded-lg hover:bg-sage/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : "Confirm Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
