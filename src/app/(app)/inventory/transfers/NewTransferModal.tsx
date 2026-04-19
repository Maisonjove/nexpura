"use client";

import { useState, useMemo } from "react";
import { X, Search, Package, Plus, Minus, ArrowRight, AlertCircle } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";

interface Location {
  id: string;
  name: string;
  type?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  location_id: string | null;
}

interface TransferItem {
  inventoryId: string;
  name: string;
  sku: string | null;
  availableQty: number;
  quantity: number;
}

interface Props {
  locations: Location[];
  inventory: InventoryItem[];
  tenantId: string;
  allowedLocationIds: string[] | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewTransferModal({
  locations,
  inventory,
  tenantId,
  allowedLocationIds,
  onClose,
  onSuccess,
}: Props) {
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter locations user can select as source (must have access)
  const sourceLocations = useMemo(() => {
    if (allowedLocationIds === null) return locations;
    return locations.filter(l => allowedLocationIds.includes(l.id));
  }, [locations, allowedLocationIds]);

  // Filter inventory by selected source location
  const availableInventory = useMemo(() => {
    if (!fromLocationId) return [];
    return inventory.filter(i => i.location_id === fromLocationId && i.quantity > 0);
  }, [inventory, fromLocationId]);

  // Filter inventory by search
  const filteredInventory = useMemo(() => {
    if (!itemSearch.trim()) return availableInventory;
    const search = itemSearch.toLowerCase();
    return availableInventory.filter(i => 
      i.name.toLowerCase().includes(search) ||
      i.sku?.toLowerCase().includes(search)
    );
  }, [availableInventory, itemSearch]);

  // Items not yet added to transfer
  const unselectedInventory = useMemo(() => {
    const selectedIds = new Set(items.map(i => i.inventoryId));
    return filteredInventory.filter(i => !selectedIds.has(i.id));
  }, [filteredInventory, items]);

  function addItem(inv: InventoryItem) {
    setItems([...items, {
      inventoryId: inv.id,
      name: inv.name,
      sku: inv.sku,
      availableQty: inv.quantity,
      quantity: 1,
    }]);
  }

  function removeItem(inventoryId: string) {
    setItems(items.filter(i => i.inventoryId !== inventoryId));
  }

  function updateItemQty(inventoryId: string, qty: number) {
    setItems(items.map(i => {
      if (i.inventoryId !== inventoryId) return i;
      return { ...i, quantity: Math.max(1, Math.min(qty, i.availableQty)) };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fromLocationId || !toLocationId) {
      setError("Please select both locations");
      return;
    }

    if (fromLocationId === toLocationId) {
      setError("Source and destination cannot be the same");
      return;
    }

    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/inventory/transfers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocationId,
          toLocationId,
          notes: notes.trim() || null,
          items: items.map(i => ({
            inventoryId: i.inventoryId,
            quantity: i.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create transfer");
        return;
      }

      onSuccess();
    } catch (err) {
      setError("Failed to create transfer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">New Stock Transfer</h2>
            <p className="text-sm text-stone-500">Move items between locations</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-stone-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Locations */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  From Location
                </label>
                <select
                  value={fromLocationId}
                  onChange={(e) => {
                    setFromLocationId(e.target.value);
                    setItems([]); // Clear items when source changes
                  }}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl outline-none focus:border-amber-500 bg-white"
                  required
                >
                  <option value="">Select origin...</option>
                  {sourceLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  To Location
                </label>
                <select
                  value={toLocationId}
                  onChange={(e) => setToLocationId(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl outline-none focus:border-amber-500 bg-white"
                  required
                >
                  <option value="">Select destination...</option>
                  {locations.filter(l => l.id !== fromLocationId).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Route Preview */}
            {fromLocationId && toLocationId && (
              <div className="flex items-center justify-center gap-3 py-3 px-4 bg-amber-50 rounded-xl border border-amber-100">
                <span className="font-medium text-amber-900">
                  {locations.find(l => l.id === fromLocationId)?.name}
                </span>
                <ArrowRight size={16} className="text-amber-500" />
                <span className="font-medium text-amber-900">
                  {locations.find(l => l.id === toLocationId)?.name}
                </span>
              </div>
            )}

            {/* Items Selection */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Items to Transfer
              </label>

              {!fromLocationId ? (
                <div className="py-8 text-center text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                  Select a source location to see available items
                </div>
              ) : (
                <>
                  {/* Selected Items */}
                  {items.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {items.map((item) => (
                        <div
                          key={item.inventoryId}
                          className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-3"
                        >
                          <Package size={16} className="text-amber-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-stone-900 truncate">{item.name}</p>
                            {item.sku && (
                              <p className="text-xs text-stone-500">SKU: {item.sku}</p>
                            )}
                          </div>
                          
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.inventoryId, item.quantity - 1)}
                              className="p-1 hover:bg-stone-100 rounded"
                              disabled={item.quantity <= 1}
                            >
                              <Minus size={14} className="text-stone-500" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={item.availableQty}
                              value={item.quantity}
                              onChange={(e) => updateItemQty(item.inventoryId, parseInt(e.target.value) || 1)}
                              className="w-16 text-center px-2 py-1 border border-stone-200 rounded text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.inventoryId, item.quantity + 1)}
                              className="p-1 hover:bg-stone-100 rounded"
                              disabled={item.quantity >= item.availableQty}
                            >
                              <Plus size={14} className="text-stone-500" />
                            </button>
                          </div>
                          
                          <span className="text-xs text-stone-400 w-20 text-right">
                            of {item.availableQty}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => removeItem(item.inventoryId)}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Item Search */}
                  <div className="relative mb-3">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search items by name or SKU..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Available Items */}
                  <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                    {unselectedInventory.length === 0 ? (
                      <div className="py-6 text-center text-stone-400 text-sm">
                        {availableInventory.length === 0 
                          ? "No items available at this location"
                          : items.length === availableInventory.length
                            ? "All items added"
                            : "No matching items found"
                        }
                      </div>
                    ) : (
                      unselectedInventory.slice(0, 50).map((inv) => (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => addItem(inv)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors text-left"
                        >
                          <Package size={16} className="text-stone-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-stone-900 truncate">{inv.name}</p>
                            {inv.sku && (
                              <p className="text-xs text-stone-500">SKU: {inv.sku}</p>
                            )}
                          </div>
                          <span className="text-sm text-stone-500">
                            Qty: {inv.quantity}
                          </span>
                          <Plus size={16} className="text-amber-600 flex-shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this transfer..."
                className="w-full px-4 py-3 border border-stone-200 rounded-xl outline-none focus:border-amber-500 resize-none h-20"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-between bg-stone-50">
            <div className="text-sm text-stone-500">
              {items.length > 0 && (
                <span>
                  {items.length} item{items.length !== 1 ? "s" : ""}, {items.reduce((sum, i) => sum + i.quantity, 0)} units total
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <SubmitButton
                isPending={loading}
                disabled={items.length === 0}
                idleLabel="Create Transfer"
                pendingLabel="Creating..."
                className="px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
