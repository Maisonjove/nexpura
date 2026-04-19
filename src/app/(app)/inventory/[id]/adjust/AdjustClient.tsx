"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adjustStock } from "../../actions";
import { useFormHydrated } from "@/components/ui/submit-button";

const MOVEMENT_TYPES = [
  { value: "purchase", label: "Purchase (stock in)" },
  { value: "adjustment", label: "Adjustment (manual)" },
  { value: "return", label: "Customer Return" },
  { value: "damage", label: "Damage / Loss" },
  { value: "transfer", label: "Transfer" },
];

interface Props {
  inventoryId: string;
  itemName: string;
  itemSku: string | null;
  currentQty: number;
}

export default function AdjustClient({ inventoryId, itemName, itemSku, currentQty }: Props) {
  const router = useRouter();
  const [movementType, setMovementType] = useState("adjustment");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydrated = useFormHydrated();

  const quantityChange = quantity ? (direction === "add" ? parseInt(quantity) : -parseInt(quantity)) : 0;
  const newQty = currentQty + quantityChange;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || parseInt(quantity) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }
    if (newQty < 0) {
      setError("Stock cannot go below 0");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await adjustStock(inventoryId, movementType, quantityChange, notes);
        router.push(`/inventory/${inventoryId}`);
      } catch (err) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          setError(err.message);
        } else {
          router.push(`/inventory/${inventoryId}`);
        }
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/inventory/${inventoryId}`}
        className="text-sm text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1"
      >
        ← Back to Item
      </Link>
      <h1 className="text-2xl font-semibold text-stone-900 mt-4 mb-2">Adjust Stock</h1>
      <p className="text-sm text-stone-500 mb-8">
        {itemName}
        {itemSku && <span className="text-stone-400 ml-2 font-mono text-xs">{itemSku}</span>}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Current stock display */}
          <div className="bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Current Stock</span>
              <span className="text-lg font-semibold text-stone-900">{currentQty} units</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Movement Type</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            >
              {MOVEMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Direction</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDirection("add")}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  direction === "add"
                    ? "bg-green-50 text-green-700 border-green-300"
                    : "bg-white text-stone-500 border-stone-200 hover:border-amber-600/50"
                }`}
              >
                + Add Stock
              </button>
              <button
                type="button"
                onClick={() => setDirection("remove")}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  direction === "remove"
                    ? "bg-red-50 text-red-700 border-red-300"
                    : "bg-white text-stone-500 border-stone-200 hover:border-amber-600/50"
                }`}
              >
                − Remove Stock
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            />
          </div>

          {/* Preview */}
          {quantity && parseInt(quantity) > 0 && (
            <div
              className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm ${
                newQty < 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
              }`}
            >
              <span className="text-stone-500">New stock level</span>
              <span
                className={`font-semibold text-lg ${
                  newQty < 0 ? "text-red-600" : "text-stone-900"
                }`}
              >
                {currentQty} → {newQty < 0 ? <span className="text-red-600">Invalid</span> : newQty}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-stone-100">
            <button
              type="submit"
              disabled={!hydrated || isPending || !quantity || parseInt(quantity) <= 0 || newQty < 0}
              className="px-5 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {!hydrated ? (
                "Preparing…"
              ) : isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                "Confirm Adjustment"
              )}
            </button>
            <Link
              href={`/inventory/${inventoryId}`}
              className="px-4 py-2.5 border border-stone-200 text-stone-600 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
