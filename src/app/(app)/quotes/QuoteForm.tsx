"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { createQuote, type QuoteItem } from "./actions-server";
import { toast } from "sonner";
import logger from "@/lib/logger";
import { SubmitButton } from "@/components/ui/submit-button";

interface Customer {
  id: string;
  full_name: string | null;
}

interface Props {
  tenantId: string;
  customers: Customer[];
}

export default function QuoteForm({ tenantId, customers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [customerId, setCustomerId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  function addItem() {
    setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof QuoteItem, value: string | number) {
    const newItems = [...items];
    if (field === 'description') {
      newItems[index].description = value as string;
    } else if (field === 'quantity') {
      newItems[index].quantity = value as number;
    } else if (field === 'unit_price') {
      newItems[index].unit_price = value as number;
    }
    setItems(newItems);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { toast.error("Please select a customer"); return; }
    setLoading(true);
    try {
      const result = await createQuote({
        customer_id: customerId,
        items,
        total_amount: totalAmount,
        status: "draft",
        expires_at: expiresAt || null,
        notes,
      });
      // Don't silently redirect on failure — surface the error so the user
      // knows nothing was saved instead of landing on the list thinking it
      // worked.
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      router.push("/quotes");
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
      logger.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create quote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">New Quote</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <SubmitButton
            isPending={loading}
            idleLabel={<><Save size={18} /> Save Quote</>}
            pendingLabel={<><Save size={18} /> Saving...</>}
            preparingLabel={<><Save size={18} /> Preparing…</>}
            className="flex items-center gap-2 bg-nexpura-charcoal text-white px-4 py-2 rounded-lg hover:bg-nexpura-charcoal-700 transition-colors font-medium disabled:opacity-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-stone-900">Details</h2>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Customer</label>
            <select
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select a customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Expiry Date</label>
            <input
              type="date"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-stone-900">Notes</h2>
          <textarea
            rows={4}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30 resize-none"
            placeholder="Internal notes or message to customer..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Items</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 text-amber-700 hover:text-[#7a6349] text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="flex gap-4 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Item description..."
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30"
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                  required
                />
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="w-32">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    className="w-full pl-7 pr-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>
              <div className="w-32 py-2 text-right font-medium text-stone-900">
                ${(item.quantity * item.unit_price).toLocaleString()}
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2 text-stone-400 hover:text-red-600 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-stone-100">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>${totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-stone-900 pt-2 border-t border-stone-100">
              <span>Total</span>
              <span>${totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
