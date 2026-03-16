"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { batchReceiveStock } from "./actions";

interface Supplier {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
}

interface ReceiveLine {
  inventoryId: string;
  name: string;
  sku: string | null;
  currentQty: number;
  receiveQty: number;
}

interface Props {
  tenantId: string;
  userId: string;
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
}

export default function BatchReceiveClient({ tenantId, userId, suppliers, inventoryItems }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredItems = inventoryItems.filter((i) => {
    if (!itemSearch) return true;
    return (
      i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (i.sku && i.sku.toLowerCase().includes(itemSearch.toLowerCase()))
    );
  });

  function addLine(item: InventoryItem) {
    if (lines.find((l) => l.inventoryId === item.id)) return;
    setLines((prev) => [
      ...prev,
      { inventoryId: item.id, name: item.name, sku: item.sku, currentQty: item.quantity, receiveQty: 1 },
    ]);
    setItemSearch("");
  }

  function updateQty(inventoryId: string, qty: number) {
    setLines((prev) => prev.map((l) => l.inventoryId === inventoryId ? { ...l, receiveQty: Math.max(0, qty) } : l));
  }

  function removeLine(inventoryId: string) {
    setLines((prev) => prev.filter((l) => l.inventoryId !== inventoryId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setMsg({ type: "error", text: "Add at least one item to receive" });
      return;
    }

    startTransition(async () => {
      const result = await batchReceiveStock({
        tenantId,
        userId,
        supplierId: supplierId || null,
        invoiceRef: invoiceRef || null,
        lines: lines.map((l) => ({ inventoryId: l.inventoryId, receiveQty: l.receiveQty })),
      });

      if (result.error) {
        setMsg({ type: "error", text: result.error });
      } else {
        setMsg({ type: "success", text: `Successfully received ${lines.length} item(s)!` });
        setLines([]);
        setSupplierId("");
        setInvoiceRef("");
        setTimeout(() => router.push("/inventory"), 2000);
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Link href="/inventory" className="hover:text-amber-700">Inventory</Link>
        <span>›</span>
        <span className="text-stone-900">Receive Stock</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Receive Stock</h1>
        <p className="text-stone-500 mt-1 text-sm">Batch-add received stock from a supplier</p>
      </div>

      {msg && (
        <div className={`rounded-xl p-3 text-sm ${msg.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-stone-900">Delivery Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Supplier (optional)</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Supplier Invoice Number</label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="e.g. INV-2024-001"
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-stone-900">Items Received</h2>

          {/* Search to add item */}
          <div className="relative">
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search existing inventory items to add…"
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            {itemSearch && filteredItems.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {filteredItems.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addLine(item)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center justify-between"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-stone-400 text-xs">{item.sku} · Qty: {item.quantity}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lines */}
          {lines.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">Search and add items to receive</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 text-xs font-semibold text-stone-500">Item</th>
                  <th className="text-center py-2 text-xs font-semibold text-stone-500 w-24">Current Qty</th>
                  <th className="text-center py-2 text-xs font-semibold text-stone-500 w-32">Receive Qty</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lines.map((line) => (
                  <tr key={line.inventoryId}>
                    <td className="py-3">
                      <p className="font-medium text-stone-900">{line.name}</p>
                      {line.sku && <p className="text-xs text-stone-400 font-mono">{line.sku}</p>}
                    </td>
                    <td className="py-3 text-center text-stone-500">{line.currentQty}</td>
                    <td className="py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={line.receiveQty}
                        onChange={(e) => updateQty(line.inventoryId, parseInt(e.target.value) || 0)}
                        className="w-20 border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-600"
                      />
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => removeLine(line.inventoryId)}
                        className="text-stone-300 hover:text-red-400 text-xs"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200">
                  <td className="py-3 font-medium text-stone-900">Total received:</td>
                  <td />
                  <td className="py-3 text-center font-bold text-stone-900">
                    {lines.reduce((s, l) => s + l.receiveQty, 0)} units
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending || lines.length === 0}
            className="flex-1 py-3 bg-amber-700 text-white rounded-xl font-semibold text-sm hover:bg-[#7a6447] transition-colors disabled:opacity-50"
          >
            {isPending ? "Receiving…" : `Receive ${lines.length} Item${lines.length !== 1 ? "s" : ""}`}
          </button>
          <Link
            href="/inventory"
            className="px-5 py-3 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
