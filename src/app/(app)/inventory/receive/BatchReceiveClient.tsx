"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  InboxArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { batchReceiveStock } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

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
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
}

export default function BatchReceiveClient({ suppliers, inventoryItems }: Props) {
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

  const totalUnits = lines.reduce((s, l) => s + l.receiveQty, 0);

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/inventory"
              className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
              aria-label="Back to inventory"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Inventory
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
                Receive Stock
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Batch-add received stock from a supplier and update quantities across your inventory.
              </p>
            </div>
          </div>
        </div>

        {/* Status message */}
        {msg && (
          <div
            className={`mb-8 flex items-start gap-3 rounded-2xl border-l-2 border-y border-r border-stone-200 bg-white p-5 ${
              msg.type === "success" ? "border-l-emerald-600" : "border-l-[#7A1F1F]"
            }`}
          >
            {msg.type === "success" ? (
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 text-[#7A1F1F] shrink-0 mt-0.5" />
            )}
            <p
              className={`text-sm leading-relaxed ${
                msg.type === "success" ? "text-emerald-800" : "text-[#7A1F1F]"
              }`}
            >
              {msg.text}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Delivery Details Card */}
          <div className="nx-card hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400">
            <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
              Step 01
            </p>
            <h2 className="font-serif text-2xl text-stone-900 tracking-tight mb-6">
              Delivery details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Supplier
                  <span className="text-stone-400 font-normal ml-1">(optional)</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Supplier invoice number
                </label>
                <input
                  type="text"
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                  placeholder="e.g. INV-2024-001"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Items Received Card */}
          <div className="nx-card hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400">
            <div className="flex items-baseline justify-between gap-4 mb-6">
              <div>
                <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                  Step 02
                </p>
                <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                  Items received
                </h2>
              </div>
              {lines.length > 0 && (
                <span className="nx-badge-neutral tabular-nums">
                  {lines.length} item{lines.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Search to add item */}
            <div className="relative mb-6">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search existing inventory items to add…"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
              />
              {itemSearch && filteredItems.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] max-h-64 overflow-y-auto z-10">
                  {filteredItems.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addLine(item)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-stone-50 flex items-center justify-between gap-4 transition-colors duration-200 border-b border-stone-100 last:border-b-0"
                    >
                      <span className="font-medium text-stone-900 truncate">{item.name}</span>
                      <span className="text-stone-400 text-xs shrink-0 tabular-nums flex items-center gap-2">
                        {item.sku && <span className="font-mono">{item.sku}</span>}
                        {item.sku && <span className="text-stone-300">·</span>}
                        <span>Qty {item.quantity}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lines */}
            {lines.length === 0 ? (
              <div className="border border-dashed border-stone-200 rounded-xl py-14 px-6 text-center">
                <InboxArrowDownIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
                <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                  No items added yet
                </h3>
                <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">
                  Search above to add items from your inventory and set the quantities you have received.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((line) => (
                  <div
                    key={line.inventoryId}
                    className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900 truncate">{line.name}</p>
                      {line.sku && (
                        <p className="text-xs text-stone-400 font-mono mt-0.5">{line.sku}</p>
                      )}
                    </div>

                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-0.5">
                        Current
                      </p>
                      <p className="text-sm text-stone-700 tabular-nums">{line.currentQty}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <label className="block text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-0.5">
                        Receive
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={line.receiveQty}
                        onChange={(e) => updateQty(line.inventoryId, parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 rounded-md border border-stone-200 text-sm text-center text-stone-900 tabular-nums focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLine(line.inventoryId)}
                      className="text-stone-400 hover:text-red-500 transition-colors duration-200 shrink-0 p-1"
                      aria-label={`Remove ${line.name}`}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Total summary */}
                <div className="flex items-baseline justify-between gap-4 pt-5 mt-2 border-t border-stone-200">
                  <span className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                    Total received
                  </span>
                  <span className="font-serif text-3xl text-stone-900 tracking-tight tabular-nums">
                    {totalUnits}
                    <span className="ml-2 text-sm font-sans font-normal text-stone-400 tracking-normal">
                      unit{totalUnits !== 1 ? "s" : ""}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
            <Link
              href="/inventory"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors duration-200"
            >
              Cancel
            </Link>
            <SubmitButton
              isPending={isPending}
              disabled={lines.length === 0}
              idleLabel={`Receive ${lines.length} Item${lines.length !== 1 ? "s" : ""}`}
              pendingLabel="Receiving…"
              className="nx-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
