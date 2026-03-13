"use client";

import { useState, useTransition } from "react";
import { createSale } from "./actions";

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: "quote", label: "Quote" },
  { value: "confirmed", label: "Confirmed" },
  { value: "paid", label: "Paid" },
  { value: "layby", label: "Layby" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "layby", label: "Layby" },
  { value: "account", label: "Account" },
];

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]";

const selectCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-900 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export default function SaleForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, line_total: 0 },
  ]);
  const [discountAmount, setDiscountAmount] = useState(0);

  function updateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_price") {
          updated.line_total =
            Math.round(Number(updated.quantity) * Number(updated.unit_price) * 100) / 100;
        }
        return updated;
      })
    );
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, line_total: 0 },
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
  const taxAmount = Math.round((subtotal - discountAmount) * 0.1 * 100) / 100;
  const total = subtotal - discountAmount + taxAmount;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set(
      "line_items",
      JSON.stringify(
        lineItems.map(({ description, quantity, unit_price, line_total }) => ({
          description,
          quantity,
          unit_price,
          line_total,
        }))
      )
    );

    startTransition(async () => {
      const result = await createSale(formData);
      if (result?.error) setError(result.error);
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
            <select id="status" name="status" defaultValue="quote" className={selectCls}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="payment_method">Payment Method</FieldLabel>
            <select id="payment_method" name="payment_method" defaultValue="" className={selectCls}>
              <option value="">Select method…</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Line Items */}
      <Section title="Line Items">
        <div className="space-y-3">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wider px-1">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Unit Price</div>
            <div className="col-span-2 text-right">Line Total</div>
            <div className="col-span-1" />
          </div>

          {lineItems.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-12 sm:col-span-5">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                  placeholder="Item description…"
                  className={inputCls}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                  className={inputCls}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) =>
                    updateLineItem(item.id, "unit_price", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              <div className="col-span-3 sm:col-span-2 text-right text-sm font-medium text-stone-900">
                {fmtCurrency(item.line_total)}
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeLineItem(item.id)}
                  disabled={lineItems.length === 1}
                  className="text-stone-400 hover:text-red-400 transition-colors disabled:opacity-20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-2 text-sm text-[#8B7355] font-medium hover:text-[#8B7355]/80 transition-colors"
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
            <span className="font-medium text-stone-900">{fmtCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="discount_amount" className="text-stone-500">
              Discount
            </label>
            <input
              id="discount_amount"
              name="discount_amount"
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-32 px-3 py-1.5 text-sm text-right bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">GST (10%)</span>
            <span className="font-medium text-stone-900">{fmtCurrency(taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-200 pt-2">
            <span className="font-semibold text-stone-900">Total</span>
            <span className="font-semibold text-lg font-semibold text-stone-900">
              {fmtCurrency(total)}
            </span>
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
            placeholder="Any notes about this sale…"
            className={`${inputCls} resize-none`}
          />
        </div>
      </Section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pb-6">
        <a
          href="/sales"
          className="px-5 py-2.5 text-sm font-medium text-stone-900 bg-white border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-all"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 text-sm font-medium bg-[#8B7355] text-white rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create Sale"}
        </button>
      </div>
    </form>
  );
}
