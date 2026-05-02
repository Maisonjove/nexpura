"use client";

import { useMemo, useState, useTransition } from "react";
import { createSale, updateSale } from "./actions";

const STATUSES = [
  { value: "quote", label: "Quote" },
  { value: "confirmed", label: "Confirmed" },
  { value: "paid", label: "Paid" },
  { value: "layby", label: "Layby" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "split", label: "Split (Card + Cash)" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "layby", label: "Layby" },
  { value: "account", label: "Account" },
];

interface InventoryOption {
  id: string;
  name: string;
  sku: string | null;
  retail_price: number;
  quantity: number;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  inventory_id: string | null;
  sku: string | null;
}

interface InitialSale {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  payment_method: string | null;
  discount_amount: number | null;
  notes: string | null;
}

interface InitialLine {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number | null;
  inventory_id: string | null;
  sku: string | null;
}

interface SaleFormProps {
  taxRate?: number;
  taxName?: string;
  currency?: string;
  inventory?: InventoryOption[];
  initialSale?: InitialSale;
  initialItems?: InitialLine[];
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";
const selectCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";

function fmtCurrency(amount: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {children}
    </div>
  );
}

function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-900 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

export default function SaleForm({
  taxRate = 0.1,
  taxName = "GST",
  currency = "AUD",
  inventory = [],
  initialSale,
  initialItems,
}: SaleFormProps) {
  const isEdit = !!initialSale;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<string>(initialSale?.payment_method ?? "");
  const [discountAmount, setDiscountAmount] = useState<number>(initialSale?.discount_amount ?? 0);
  const [splitCard, setSplitCard] = useState<number>(0);
  const [splitCash, setSplitCash] = useState<number>(0);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [pickerOpenForLine, setPickerOpenForLine] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((it) => ({
        id: crypto.randomUUID(),
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount_pct: it.discount_percent ?? 0,
        inventory_id: it.inventory_id,
        sku: it.sku,
      }));
    }
    return [{ id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, discount_pct: 0, inventory_id: null, sku: null }];
  });

  function updateLineItem(id: string, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, discount_pct: 0, inventory_id: null, sku: null },
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function attachInventory(lineId: string, inv: InventoryOption) {
    updateLineItem(lineId, {
      description: inv.name,
      unit_price: inv.retail_price,
      inventory_id: inv.id,
      sku: inv.sku,
    });
    setPickerOpenForLine(null);
    setInventoryQuery("");
  }

  function clearInventory(lineId: string) {
    updateLineItem(lineId, { inventory_id: null, sku: null });
  }

  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    if (!q) return inventory.slice(0, 20);
    return inventory
      .filter((i) => i.name.toLowerCase().includes(q) || (i.sku || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [inventory, inventoryQuery]);

  const subtotal = useMemo(
    () =>
      Math.round(
        lineItems.reduce((sum, it) => {
          const disc = Math.min(Math.max(it.discount_pct, 0), 100) / 100;
          return sum + it.quantity * it.unit_price * (1 - disc);
        }, 0) * 100
      ) / 100,
    [lineItems]
  );
  const taxAmount = Math.round(Math.max(0, subtotal - discountAmount) * taxRate * 100) / 100;
  const total = Math.max(0, subtotal - discountAmount) + taxAmount;

  const splitMismatch =
    paymentMethod === "split" && Math.abs((splitCard + splitCash) - total) > 0.01;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (splitMismatch) {
      setError(`Split payment must sum to ${total.toFixed(2)} (got ${(splitCard + splitCash).toFixed(2)})`);
      return;
    }
    const formData = new FormData(e.currentTarget);
    formData.set(
      "line_items",
      JSON.stringify(
        lineItems.map(({ description, quantity, unit_price, discount_pct, inventory_id, sku }) => ({
          description,
          quantity,
          unit_price,
          discount_pct,
          inventory_id,
          sku,
          name: description,
        }))
      )
    );
    if (paymentMethod === "split") {
      formData.set("split_card_amount", String(splitCard));
      formData.set("split_cash_amount", String(splitCash));
    }

    startTransition(async () => {
      const result = isEdit && initialSale
        ? await updateSale(initialSale.id, formData)
        : await createSale(formData);
      if (result?.error) setError(result.error);
      else if (isEdit && result?.id) {
        // updateSale doesn't redirect; nav back to detail.
        window.location.href = `/sales/${result.id}`;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Customer */}
      <Section title="Customer">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="customer_name">Customer Name</FieldLabel>
            <input
              id="customer_name"
              name="customer_name"
              type="text"
              defaultValue={initialSale?.customer_name ?? ""}
              placeholder="e.g. Sarah Johnson"
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel htmlFor="customer_email">Customer Email</FieldLabel>
            <input
              id="customer_email"
              name="customer_email"
              type="email"
              defaultValue={initialSale?.customer_email ?? ""}
              placeholder="sarah@example.com"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      {/* Sale Details */}
      <Section title="Sale Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <select id="status" name="status" defaultValue={initialSale?.status ?? "quote"} className={selectCls} disabled={isEdit}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {isEdit && (
              <p className="text-xs text-stone-500 mt-1">Status changes from the detail page.</p>
            )}
          </div>
          <div>
            <FieldLabel htmlFor="payment_method">Payment Method</FieldLabel>
            <select
              id="payment_method"
              name="payment_method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={selectCls}
            >
              <option value="">Select method…</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        {paymentMethod === "split" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="split_card_amount">Card Amount</FieldLabel>
              <input
                id="split_card_amount"
                type="number"
                min="0"
                step="0.01"
                value={splitCard}
                onChange={(e) => setSplitCard(parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel htmlFor="split_cash_amount">Cash Amount</FieldLabel>
              <input
                id="split_cash_amount"
                type="number"
                min="0"
                step="0.01"
                value={splitCash}
                onChange={(e) => setSplitCash(parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </div>
            <p className={`col-span-full text-xs ${splitMismatch ? "text-red-600" : "text-stone-500"}`}>
              {splitMismatch
                ? `Split must equal total ${fmtCurrency(total, currency)} — currently ${fmtCurrency(splitCard + splitCash, currency)}`
                : `Card + Cash = ${fmtCurrency(splitCard + splitCash, currency)} (target ${fmtCurrency(total, currency)})`}
            </p>
          </div>
        )}
      </Section>

      {/* Line Items */}
      <Section title="Line Items">
        <div className="space-y-3">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wider px-1">
            <div className="col-span-4">Description</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Unit Price</div>
            <div className="col-span-1 text-right">Disc%</div>
            <div className="col-span-2 text-right">Line Total</div>
            <div className="col-span-1" />
          </div>

          {lineItems.map((item) => {
            const lineTotal =
              Math.round(item.quantity * item.unit_price * (1 - Math.min(Math.max(item.discount_pct, 0), 100) / 100) * 100) / 100;
            return (
              <div key={item.id} className="space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-4">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                      placeholder="Item description…"
                      className={inputCls}
                    />
                    {item.inventory_id ? (
                      <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-2">
                        <span>SKU {item.sku || "—"} · stock-linked</span>
                        <button
                          type="button"
                          onClick={() => clearInventory(item.id)}
                          className="text-stone-400 hover:text-red-500 underline"
                        >
                          unlink
                        </button>
                      </p>
                    ) : inventory.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setPickerOpenForLine(pickerOpenForLine === item.id ? null : item.id)}
                        className="text-[11px] text-amber-700 hover:text-amber-800 mt-1 underline"
                      >
                        {pickerOpenForLine === item.id ? "Close picker" : "Pick from inventory"}
                      </button>
                    ) : null}
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={item.discount_pct}
                      onChange={(e) => updateLineItem(item.id, { discount_pct: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 text-right text-sm font-medium text-stone-900">
                    {fmtCurrency(lineTotal, currency)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      disabled={lineItems.length === 1}
                      className="text-stone-400 hover:text-red-400 transition-colors disabled:opacity-20"
                      aria-label="Remove line"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {pickerOpenForLine === item.id && inventory.length > 0 && (
                  <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 space-y-2">
                    <input
                      type="text"
                      value={inventoryQuery}
                      onChange={(e) => setInventoryQuery(e.target.value)}
                      placeholder="Search inventory by name or SKU…"
                      className={inputCls}
                    />
                    <div className="max-h-48 overflow-y-auto divide-y divide-stone-200 border border-stone-200 rounded bg-white">
                      {filteredInventory.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-stone-500">No matching inventory.</p>
                      ) : (
                        filteredInventory.map((inv) => (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => attachInventory(item.id, inv)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50"
                          >
                            <span className="font-medium text-stone-900">{inv.name}</span>
                            <span className="text-stone-500 ml-2">{inv.sku ?? "—"}</span>
                            <span className="text-stone-500 float-right">
                              {fmtCurrency(inv.retail_price, currency)} · stock {inv.quantity}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-2 text-sm text-amber-700 font-medium hover:text-amber-700/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add line item
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-stone-200 pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Subtotal</span>
            <span className="font-medium text-stone-900">{fmtCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="discount_amount" className="text-stone-500">Discount (fixed)</label>
            <input
              id="discount_amount"
              name="discount_amount"
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-32 px-3 py-1.5 text-sm text-right bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">{taxName} ({(taxRate * 100).toFixed(0)}%)</span>
            <span className="font-medium text-stone-900">{fmtCurrency(taxAmount, currency)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-200 pt-2">
            <span className="font-semibold text-stone-900">Total</span>
            <span className="font-semibold text-lg font-semibold text-stone-900">{fmtCurrency(total, currency)}</span>
          </div>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <div>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialSale?.notes ?? ""}
            placeholder="Any notes about this sale…"
            className={`${inputCls} resize-none`}
          />
        </div>
      </Section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3 pb-6">
        <a
          href={isEdit && initialSale ? `/sales/${initialSale.id}` : "/sales"}
          className="px-5 py-2.5 text-sm font-medium text-stone-900 bg-white border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-all"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending || splitMismatch}
          className="px-6 py-2.5 text-sm font-medium bg-nexpura-charcoal text-white rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
        >
          {isPending ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save Changes" : "Create Sale"}
        </button>
      </div>
    </form>
  );
}
