"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startStocktake, countItem, completeStocktake, addManualStocktakeItem } from "../actions";
import type { Stocktake, StocktakeItem } from "../actions";
import PhotoScannerModal, { type PhotoMatch } from "@/components/PhotoScannerModal";
import CameraScannerModal from "@/components/CameraScannerModal";

interface Props {
  stocktake: Stocktake;
  items: StocktakeItem[];
  tenantId: string;
  userId: string;
}

export default function StocktakeDetailClient({ stocktake: initial, items: initialItems, tenantId, userId }: Props) {
  const router = useRouter();
  const [stocktake, setStocktake] = useState(initial);
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "counted" | "uncounted" | "discrepancy">("all");
  const [search, setSearch] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showPhotoScanner, setShowPhotoScanner] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("0");
  const [manualSku, setManualSku] = useState("");
  const [countingItemId, setCountingItemId] = useState<string | null>(null);
  const [countValue, setCountValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const handlePhotoScanApply = (matches: PhotoMatch[]) => {
        startTransition(async () => {
              for (const match of matches) {
                      await countItem(match.id, stocktake.id, match.quantity);
                            }
                                  setItems((prev) =>
                                          prev.map((item) => {
                                                    const found = matches.find((m) => m.id === item.id);
                                                              if (found) {
                                                                          return { ...item, counted_qty: found.quantity, discrepancy: found.quantity - item.expected_qty };
                                                                                    }
                                                                                              return item;
                                                                                                      })
                                                                                                            );
                                                                                                                });
                                                                                                                  };
  const progress = items.length > 0
    ? Math.round((items.filter((i) => i.counted_qty !== null).length / items.length) * 100)
    : 0;

  const discrepancyItems = items.filter((i) => i.counted_qty !== null && i.discrepancy !== 0);

  const filtered = items.filter((item) => {
    if (filter === "counted" && item.counted_qty === null) return false;
    if (filter === "uncounted" && item.counted_qty !== null) return false;
    if (filter === "discrepancy" && (item.counted_qty === null || item.discrepancy === 0)) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!item.item_name.toLowerCase().includes(s) && !(item.sku ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  function handleStart() {
    startTransition(async () => {
      const result = await startStocktake(stocktake.id);
      if (result.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  function handleScanResult(barcode: string) {
    // Find item by barcode
    const found = items.find((i) => i.barcode_value === barcode || i.sku === barcode);
    if (found) {
      setCountingItemId(found.id);
      setCountValue("1");
    } else {
      setError(`No item found for barcode: ${barcode}`);
      setTimeout(() => setError(null), 3000);
    }
  }

  function handleCountSave(itemId: string) {
    const qty = parseInt(countValue);
    if (isNaN(qty) || qty < 0) return;
    startTransition(async () => {
      const result = await countItem(itemId, stocktake.id, qty);
      if (result.error) { setError(result.error); return; }
      setItems((prev) => prev.map((i) =>
        i.id === itemId
          ? { ...i, counted_qty: qty, discrepancy: qty - i.expected_qty, counted_at: new Date().toISOString() }
          : i
      ));
      setCountingItemId(null);
      setCountValue("");
    });
  }

  function handleComplete(withAdj: boolean) {
    if (!confirm(withAdj
      ? "Apply counted quantities to inventory? This will update stock levels."
      : "Complete stocktake without applying adjustments?"
    )) return;
    startTransition(async () => {
      const result = await completeStocktake(stocktake.id, withAdj);
      if (result.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  function handleAddManual() {
    if (!manualName.trim()) return;
    startTransition(async () => {
      const result = await addManualStocktakeItem(stocktake.id, manualName, parseInt(manualQty) || 0, manualSku);
      if (result.error) { setError(result.error); return; }
      setShowAddManual(false);
      setManualName(""); setManualQty("0"); setManualSku("");
      router.refresh();
    });
  }

  const isDraft = stocktake.status === "draft";
  const isInProgress = stocktake.status === "in_progress";
  const isComplete = stocktake.status === "completed";

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <Link href="/stocktakes" className="text-sm text-stone-400 hover:text-stone-600 mb-1 inline-block">
            ← Stocktakes
          </Link>
          <h1 className="text-2xl font-semibold text-stone-900">{stocktake.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-stone-400 flex-wrap">
            {stocktake.reference_number && <span className="font-mono">{stocktake.reference_number}</span>}
            {stocktake.location && <span>📍 {stocktake.location}</span>}
            <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${
              stocktake.status === "completed" ? "bg-green-50 text-green-700" :
              stocktake.status === "in_progress" ? "bg-amber-50 text-amber-700" :
              "bg-stone-100 text-stone-600"
            }`}>{stocktake.status.replace("_", " ")}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isDraft && (
            <button
              onClick={handleStart}
              disabled={isPending}
              className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-60"
            >
              {isPending ? "Starting…" : "▶ Start Count"}
            </button>
          )}
          {isInProgress && (
            <>
              <button
                onClick={() => setShowScanner(true)}
                className="px-3 py-2 border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-50"
              >
                📷 Scan
              </button>
                      <button
                                onClick={() => setShowPhotoScanner(true)}
                                          className="px-3 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-50"
                                                  >
                                                            📸 AI Scan
                                                                    </button>
              <button
                onClick={() => setShowAddManual(true)}
                className="px-3 py-2 border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-50"
              >
                + Add Item
              </button>
              <button
                onClick={() => handleComplete(false)}
                disabled={isPending}
                className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
              >
                Complete
              </button>
              <button
                onClick={() => handleComplete(true)}
                disabled={isPending}
                className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-60"
              >
                ✓ Apply & Complete
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Progress */}
      {isInProgress && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-medium text-stone-700">
              Progress — {items.filter((i) => i.counted_qty !== null).length} of {items.length} items counted
            </div>
            <div className="text-sm font-bold text-amber-700">{progress}%</div>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-700 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {discrepancyItems.length > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ {discrepancyItems.length} discrepancies found
            </p>
          )}
        </div>
      )}

      {/* Summary for completed */}
      {isComplete && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Items Counted", value: stocktake.total_items_counted, icon: "🔢" },
            { label: "Discrepancies", value: stocktake.total_discrepancies, icon: "⚠️", warn: stocktake.total_discrepancies > 0 },
            { label: "Completed", value: stocktake.completed_at ? new Date(stocktake.completed_at).toLocaleDateString("en-AU") : "—", icon: "✓" },
          ].map((stat) => (
            <div key={stat.label} className={`bg-white rounded-xl border p-4 ${stat.warn ? "border-amber-200" : "border-stone-200"}`}>
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className={`text-lg font-bold ${stat.warn ? "text-amber-700" : "text-stone-900"}`}>{stat.value}</div>
              <div className="text-xs text-stone-500">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="flex-1 min-w-48 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
          />
          {(["all", "uncounted", "counted", "discrepancy"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {f === "discrepancy" ? "⚠️ Discrepancies" : f.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {/* Item list */}
      {isDraft ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">▶</div>
          <p className="text-stone-600 font-medium">Ready to start</p>
          <p className="text-sm mt-1">Click "Start Count" to import your inventory and begin counting</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-stone-400">No items to count</div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="divide-y divide-stone-100">
            {filtered.map((item) => {
              const isCounting = countingItemId === item.id;
              const hasCounted = item.counted_qty !== null;
              const hasDiscrepancy = hasCounted && item.discrepancy !== 0;

              return (
                <div
                  key={item.id}
                  className={`px-5 py-4 flex items-center gap-4 ${
                    hasDiscrepancy ? "bg-amber-50/50" : hasCounted ? "bg-green-50/30" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-900 text-sm">{item.item_name}</span>
                      {item.sku && <span className="text-xs text-stone-400 font-mono">{item.sku}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500">
                      <span>Expected: {item.expected_qty}</span>
                      {hasCounted && (
                        <>
                          <span>Counted: {item.counted_qty}</span>
                          {hasDiscrepancy && (
                            <span className={`font-medium ${item.discrepancy > 0 ? "text-green-600" : "text-red-600"}`}>
                              {item.discrepancy > 0 ? "+" : ""}{item.discrepancy}
                            </span>
                          )}
                          {!hasDiscrepancy && <span className="text-green-600">✓ Match</span>}
                        </>
                      )}
                    </div>
                  </div>

                  {isInProgress && (
                    <div className="flex items-center gap-2">
                      {isCounting ? (
                        <>
                          <input
                            type="number"
                            value={countValue}
                            onChange={(e) => setCountValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCountSave(item.id)}
                            min="0"
                            autoFocus
                            className="w-20 px-2 py-1.5 border border-amber-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                          />
                          <button
                            onClick={() => handleCountSave(item.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-medium"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => { setCountingItemId(null); setCountValue(""); }}
                            className="px-2 py-1.5 text-stone-400 hover:text-stone-600 text-xs"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setCountingItemId(item.id);
                            setCountValue(item.counted_qty?.toString() ?? "");
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            hasCounted
                              ? "border border-stone-200 text-stone-600 hover:bg-stone-50"
                              : "bg-amber-700 text-white hover:bg-amber-800"
                          }`}
                        >
                          {hasCounted ? "Edit" : "Count"}
                        </button>
                      )}
                    </div>
                  )}

                  {isComplete && hasCounted && (
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      hasDiscrepancy
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {hasDiscrepancy ? `${item.discrepancy > 0 ? "+" : ""}${item.discrepancy}` : "✓"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Camera scanner modal */}
      {showScanner && (
        <CameraScannerModal
          onScan={handleScanResult}
          onClose={() => setShowScanner(false)}
          title="Scan Item Barcode"
        />
      )}
            {/* AI Photo scanner modal */}
                  {showPhotoScanner && (
                          <PhotoScannerModal
                                    stocktakeId={stocktake.id}
                                              onApply={handlePhotoScanApply}
                                                        onClose={() => setShowPhotoScanner(false)}
                                                                />
                                                                      )}

      {/* Manual add modal */}
      {showAddManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-stone-900 mb-4">Add Item Manually</h3>
            <div className="space-y-3">
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Item name *"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
              />
              <input
                value={manualSku}
                onChange={(e) => setManualSku(e.target.value)}
                placeholder="SKU (optional)"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
              />
              <input
                type="number"
                value={manualQty}
                onChange={(e) => setManualQty(e.target.value)}
                placeholder="Expected qty"
                min="0"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddManual(false)} className="flex-1 px-3 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm">Cancel</button>
              <button onClick={handleAddManual} disabled={isPending || !manualName.trim()} className="flex-1 px-3 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {isPending ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
