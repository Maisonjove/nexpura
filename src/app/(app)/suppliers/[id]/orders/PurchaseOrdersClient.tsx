"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPurchaseOrder, updatePurchaseOrderStatus } from "./actions";

interface Supplier {
  id: string;
  name: string;
}

interface OrderItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  inventory_item_id?: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  items: OrderItem[];
  total: number;
  status: string;
  expected_date: string | null;
  received_date: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  supplier: Supplier;
  orders: PurchaseOrder[];
  inventoryItems: InventoryItem[];
}

const STATUS_COLOURS: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  ordered: "bg-amber-50 text-amber-700",
  partial: "bg-amber-50 text-amber-700",
  received: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(n);
}

export default function PurchaseOrdersClient({ supplier, orders: initialOrders, inventoryItems }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<{ description: string; quantity: number; unit_price: number; inventory_item_id?: string | null }[]>([
    { description: "", quantity: 1, unit_price: 0, inventory_item_id: null },
  ]);
  const [notes, setNotes] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [orders, setOrders] = useState(initialOrders);

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0, inventory_item_id: null }]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, key: string, value: string | number | null) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [key]: value } : item));
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("supplier_id", supplier.id);
    fd.append("notes", notes);
    fd.append("expected_date", expectedDate);
    fd.append("items", JSON.stringify(items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      line_total: i.quantity * i.unit_price,
      inventory_item_id: i.inventory_item_id || null,
    }))));

    startTransition(async () => {
      const result = await createPurchaseOrder(fd);
      if (result?.error) {
        setMsg(`Error: ${result.error}`);
      } else {
        setMsg("Purchase order created!");
        setShowForm(false);
        setItems([{ description: "", quantity: 1, unit_price: 0 }]);
        setNotes("");
        setExpectedDate("");
        router.refresh();
      }
    });
  }

  function handleStatusChange(orderId: string, status: string) {
    startTransition(async () => {
      await updatePurchaseOrderStatus(orderId, status);
      router.refresh();
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/suppliers/${supplier.id}`} className="text-stone-400 hover:text-stone-900 text-sm transition-colors">
            ← {supplier.name}
          </Link>
          <h1 className="text-2xl font-semibold text-stone-900 mt-1">Purchase Orders</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#071A0D] text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
        >
          + New Order
        </button>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
          {msg}
        </div>
      )}

      {/* New Order Form */}
      {showForm && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900 mb-4">New Purchase Order</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Items */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">Items</label>
              {items.map((item, i) => (
                <div key={i} className="flex flex-col gap-1.5 p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788] bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      min={1}
                      onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)}
                      className="w-20 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788] bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Unit Price"
                      value={item.unit_price}
                      min={0}
                      step="0.01"
                      onChange={(e) => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                      className="w-28 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788] bg-white"
                    />
                    <span className="text-sm text-stone-500 w-24 text-right">
                      {fmtCurrency(item.quantity * item.unit_price)}
                    </span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-stone-400 hover:text-red-500">
                        ×
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-stone-400 w-28 shrink-0">Link to inventory:</label>
                    <select
                      value={item.inventory_item_id || ""}
                      onChange={(e) => updateItem(i, "inventory_item_id", e.target.value || null)}
                      className="flex-1 border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#52B788] bg-white text-stone-700"
                    >
                      <option value="">— No inventory link —</option>
                      {inventoryItems.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name}{inv.sku ? ` (${inv.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addItem} className="text-sm text-[#52B788] hover:text-[#3d9068]">
                + Add item
              </button>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Expected Delivery</label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="font-semibold text-stone-900">Total: {fmtCurrency(total)}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-[#52B788] text-white text-sm font-medium rounded-lg hover:bg-[#3d9068] transition-colors disabled:opacity-50"
                >
                  {isPending ? "Creating…" : "Create Order"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Orders list */}
      {orders.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center text-stone-400">
          No purchase orders yet
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-mono font-semibold text-stone-900">{order.order_number}</span>
                  <span className={`ml-3 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLOURS[order.status] || "bg-stone-100 text-stone-600"}`}>
                    {order.status}
                  </span>
                </div>
                <span className="font-semibold text-stone-900">{fmtCurrency(order.total)}</span>
              </div>

              {/* Items preview */}
              {order.items?.length > 0 && (
                <div className="mb-3 space-y-1">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm text-stone-600">
                      <span>{item.description} × {item.quantity}</span>
                      <span>{fmtCurrency(item.line_total)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>{new Date(order.created_at).toLocaleDateString("en-AU")}</span>
                {order.expected_date && <span>Expected: {new Date(order.expected_date).toLocaleDateString("en-AU")}</span>}
              </div>

              {/* Status actions */}
              <div className="mt-3 pt-3 border-t border-stone-100 flex gap-2">
                {order.status !== "received" && (
                  <button
                    onClick={() => handleStatusChange(order.id, "received")}
                    disabled={isPending}
                    className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors disabled:opacity-50"
                  >
                    Mark Received
                  </button>
                )}
                {order.status !== "partial" && order.status !== "received" && (
                  <button
                    onClick={() => handleStatusChange(order.id, "partial")}
                    disabled={isPending}
                    className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors disabled:opacity-50"
                  >
                    Partial
                  </button>
                )}
                {order.status !== "cancelled" && order.status !== "received" && (
                  <button
                    onClick={() => handleStatusChange(order.id, "cancelled")}
                    disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
