"use client";

import { useState } from "react";
import { X, Search, RotateCcw, Printer } from "lucide-react";

interface SaleItem {
  id: string;
  inventory_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Sale {
  id: string;
  sale_number: string;
  total: number;
  payment_method: string;
  created_at: string;
  customer_name?: string | null;
  items: SaleItem[];
}

interface RefundModalProps {
  tenantId: string;
  onClose: () => void;
}

const REFUND_REASONS = [
  "Customer changed mind",
  "Defective / damaged item",
  "Wrong item received",
  "Quality issue",
  "Other",
];

const REFUND_METHODS = [
  { value: "original", label: "Original payment method" },
  { value: "store_credit", label: "Store credit" },
  { value: "cash", label: "Cash" },
];

export default function RefundModal({ tenantId, onClose }: RefundModalProps) {
  const [receiptSearch, setReceiptSearch] = useState("");
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState("original");
  const [reason, setReason] = useState(REFUND_REASONS[0]);
  const [notes, setNotes] = useState("");

  const [isPending, setIsPending] = useState(false);
  const [refundDone, setRefundDone] = useState(false);
  const [refundResult, setRefundResult] = useState<{ refundNumber: string; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function searchSale() {
    if (!receiptSearch.trim()) return;
    setSearching(true);
    setSearchError(null);
    setFoundSale(null);
    try {
      const res = await fetch(`/api/pos/find-sale?q=${encodeURIComponent(receiptSearch.trim())}&tenantId=${tenantId}`);
      const data = await res.json();
      if (data.error) {
        setSearchError(data.error);
      } else if (data.sale) {
        setFoundSale(data.sale);
        // Default: select all items at full qty
        const defaults: Record<string, number> = {};
        (data.sale.items || []).forEach((item: SaleItem) => {
          defaults[item.id] = item.quantity;
        });
        setSelectedItems(defaults);
      } else {
        setSearchError("Sale not found");
      }
    } catch {
      setSearchError("Search failed");
    } finally {
      setSearching(false);
    }
  }

  function updateQty(itemId: string, qty: number) {
    setSelectedItems(prev => ({ ...prev, [itemId]: qty }));
  }

  const refundTotal = foundSale
    ? foundSale.items.reduce((sum, item) => {
        const qty = selectedItems[item.id] ?? 0;
        return sum + qty * item.unit_price;
      }, 0)
    : 0;

  async function processRefund() {
    if (!foundSale || refundTotal <= 0) return;
    setIsPending(true);
    setError(null);
    try {
      const items = foundSale.items
        .filter(item => (selectedItems[item.id] ?? 0) > 0)
        .map(item => ({
          saleItemId: item.id,
          quantity: selectedItems[item.id],
          unitPrice: item.unit_price,
        }));

      const res = await fetch("/api/pos/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          saleId: foundSale.id,
          items,
          refundMethod,
          reason,
          notes: notes || null,
          total: refundTotal,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setRefundResult({ refundNumber: data.refundNumber, total: refundTotal });
        setRefundDone(true);
      }
    } finally {
      setIsPending(false);
    }
  }

  if (refundDone && refundResult) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <RotateCcw className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">Refund Processed</h2>
          <p className="text-stone-500 mb-1">Refund #{refundResult.refundNumber}</p>
          <p className="text-2xl font-bold text-stone-900 mb-6">${refundResult.total.toFixed(2)}</p>
          <p className="text-sm text-stone-500 mb-6">
            Refund method: {REFUND_METHODS.find(m => m.value === refundMethod)?.label}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-stone-600" />
            </div>
            <h2 className="text-base font-semibold text-stone-900">Process Refund</h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              Find Sale
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Receipt number (e.g. S-0042)"
                value={receiptSearch}
                onChange={e => setReceiptSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchSale()}
                className="flex-1 text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              <button
                onClick={searchSale}
                disabled={searching || !receiptSearch.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-50 transition"
              >
                <Search className="w-4 h-4" />
                Find
              </button>
            </div>
            {searchError && <p className="text-xs text-red-500 mt-1">{searchError}</p>}
          </div>

          {/* Found sale */}
          {foundSale && (
            <>
              {/* Sale info */}
              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Sale #{foundSale.sale_number}</p>
                    {foundSale.customer_name && (
                      <p className="text-xs text-stone-500 mt-0.5">{foundSale.customer_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-stone-900">${foundSale.total.toFixed(2)}</p>
                    <p className="text-xs text-stone-400 capitalize">{foundSale.payment_method.replace("_", " ")}</p>
                  </div>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {new Date(foundSale.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              {/* Items to refund */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                  Items to Refund
                </label>
                <div className="space-y-2">
                  {foundSale.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border border-stone-100 rounded-xl">
                      <div className="flex-1">
                        <p className="text-sm text-stone-900">{item.inventory_name}</p>
                        <p className="text-xs text-stone-400">${item.unit_price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.id, Math.max(0, (selectedItems[item.id] ?? 0) - 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-medium">
                          {selectedItems[item.id] ?? 0}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, Math.min(item.quantity, (selectedItems[item.id] ?? 0) + 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition"
                        >
                          +
                        </button>
                        <span className="text-xs text-stone-400 ml-1">/{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refund method */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                  Refund Method
                </label>
                <select
                  value={refundMethod}
                  onChange={e => setRefundMethod(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                >
                  {REFUND_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                >
                  {REFUND_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>

              <textarea
                placeholder="Additional notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full text-sm px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
              />

              {error && <p className="text-xs text-red-500">{error}</p>}

              {/* Total + confirm */}
              <div className="border-t border-stone-100 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-stone-500">Refund Total</span>
                  <span className="text-xl font-semibold text-stone-900">${refundTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={processRefund}
                  disabled={isPending || refundTotal <= 0}
                  className="w-full py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 disabled:opacity-50 transition"
                >
                  {isPending ? "Processing..." : `Process Refund · $${refundTotal.toFixed(2)}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
