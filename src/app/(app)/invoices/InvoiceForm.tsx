"use client";

import { useState, useCallback, useTransition } from "react";
import { createInvoiceAndRedirect, updateInvoiceAndRedirect } from "./actions";
import type { LineItemInput } from "./actions";
import { useFormHydrated } from "@/components/ui/submit-button";

interface Customer {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  retail_price: number | null;
  description: string | null;
}

interface TenantSettings {
  tax_name: string;
  tax_rate: number;
  tax_inclusive: boolean;
  bank_name: string | null;
  bank_bsb: string | null;
  bank_account: string | null;
  name: string | null;
  business_name: string | null;
}

interface ExistingInvoice {
  id: string;
  customer_id: string | null;
  invoice_date: string | null;
  due_date: string | null;
  reference_type: string | null;
  reference_id: string | null;
  tax_name: string;
  tax_rate: number;
  tax_inclusive: boolean;
  discount_amount: number;
  notes: string | null;
  footer_text: string | null;
  status: string;
  layout: string | null;
  line_items: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
    sort_order: number;
    inventory_id: string | null;
  }[];
}

interface Props {
  customers: Customer[];
  tenantSettings: TenantSettings;
  existing?: ExistingInvoice;
  inventoryItems?: InventoryItem[];
}

interface LineItemRow {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  inventory_id: string | null;
}

function uuid() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function fmt(v: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(v);
}

const REFERENCE_TYPES = [
  { value: "", label: "None" },
  { value: "bespoke_job", label: "Bespoke Job" },
  { value: "repair", label: "Repair" },
  { value: "sale", label: "Sale" },
  { value: "other", label: "Other" },
];

export default function InvoiceForm({
  customers,
  tenantSettings,
  existing,
  inventoryItems = [],
}: Props) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const isEdit = !!existing;

  const [isPending, startTransition] = useTransition();
  const hydrated = useFormHydrated();
  const [error, setError] = useState<string | null>(null);
  const [showInventorySearch, setShowInventorySearch] = useState(false);
  const [inventoryQuery, setInventoryQuery] = useState("");

  // Form state
  const [customerId, setCustomerId] = useState(existing?.customer_id || "");
  const [customerSearch, setCustomerSearch] = useState(() => {
    if (existing?.customer_id) {
      const c = customers.find((x) => x.id === existing.customer_id);
      return c?.full_name || "";
    }
    return "";
  });
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(existing?.invoice_date || today);
  const [dueDate, setDueDate] = useState(existing?.due_date || "");
  const [referenceType, setReferenceType] = useState(existing?.reference_type || "");
  const [taxName, setTaxName] = useState(existing?.tax_name || tenantSettings.tax_name);
  const [taxRate, setTaxRate] = useState(existing?.tax_rate ?? tenantSettings.tax_rate);
  const [taxInclusive, setTaxInclusive] = useState(
    existing?.tax_inclusive ?? tenantSettings.tax_inclusive
  );
  const [discountAmount, setDiscountAmount] = useState(existing?.discount_amount || 0);
  const [notes, setNotes] = useState(existing?.notes || "");
  const [footerText, setFooterText] = useState(() => {
    if (existing?.footer_text) return existing.footer_text;
    const parts = [];
    if (tenantSettings.bank_name) parts.push(`Bank: ${tenantSettings.bank_name}`);
    if (tenantSettings.bank_bsb) parts.push(`BSB: ${tenantSettings.bank_bsb}`);
    if (tenantSettings.bank_account) parts.push(`Account: ${tenantSettings.bank_account}`);
    return parts.join("\n");
  });
  const [layout, setLayout] = useState<'classic' | 'modern' | 'minimal'>(
    (existing?.layout as 'classic' | 'modern' | 'minimal') || 'classic'
  );

  const [lineItems, setLineItems] = useState<LineItemRow[]>(() => {
    if (existing?.line_items?.length) {
      return existing.line_items
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((li) => ({
          id: uuid(),
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_pct: li.discount_pct || 0,
          inventory_id: li.inventory_id,
        }));
    }
    return [{ id: uuid(), description: "", quantity: 1, unit_price: 0, discount_pct: 0, inventory_id: null }];
  });

  const filteredCustomers = customers.filter((c) =>
    (c.full_name || "").toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredInventory = inventoryItems.filter(
    (i) =>
      i.name.toLowerCase().includes(inventoryQuery.toLowerCase()) ||
      (i.sku || "").toLowerCase().includes(inventoryQuery.toLowerCase())
  );

  // Calculations
  const lineTotal = lineItems.reduce((sum, item) => {
    const disc = item.discount_pct ? item.discount_pct / 100 : 0;
    return sum + item.quantity * item.unit_price * (1 - disc);
  }, 0);

  let subtotal: number;
  let taxAmount: number;
  let total: number;

  if (taxInclusive) {
    const afterDiscount = lineTotal - discountAmount;
    taxAmount = afterDiscount - afterDiscount / (1 + taxRate);
    subtotal = afterDiscount - taxAmount;
    total = afterDiscount;
  } else {
    subtotal = lineTotal;
    taxAmount = subtotal * taxRate;
    total = subtotal + taxAmount - discountAmount;
  }

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: uuid(), description: "", quantity: 1, unit_price: 0, discount_pct: 0, inventory_id: null },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  // Up/down arrow handlers — re-render the visible order, then the
  // submit path stamps `sort_order` from the array index so the DB
  // sees the new ordering without a separate save.
  const moveLineItem = (id: string, direction: "up" | "down") => {
    setLineItems((prev) => {
      const idx = prev.findIndex((li) => li.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  const updateLineItem = useCallback(
    (id: string, field: keyof LineItemRow, value: string | number | null) => {
      setLineItems((prev) =>
        prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
      );
    },
    []
  );

  const addFromInventory = (item: InventoryItem) => {
    setLineItems((prev) => [
      ...prev,
      {
        id: uuid(),
        description: item.name + (item.description ? ` — ${item.description}` : ""),
        quantity: 1,
        unit_price: item.retail_price || 0,
        discount_pct: 0,
        inventory_id: item.id,
      },
    ]);
    setShowInventorySearch(false);
    setInventoryQuery("");
  };

  const handleSubmit = (status: "draft" | "sent") => {
    if (!customerId) {
      setError("Please select a customer");
      return;
    }
    if (lineItems.length === 0 || lineItems.every((li) => !li.description)) {
      setError("Please add at least one line item");
      return;
    }

    setError(null);
    const input = {
      customer_id: customerId,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      reference_type: referenceType || null,
      reference_id: null,
      tax_name: taxName,
      tax_rate: taxRate,
      tax_inclusive: taxInclusive,
      discount_amount: discountAmount,
      notes: notes || null,
      footer_text: footerText || null,
      line_items: lineItems
        .filter((li) => li.description.trim())
        .map((li, idx) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_pct: li.discount_pct,
          sort_order: idx,
          inventory_id: li.inventory_id,
        })) as LineItemInput[],
      status,
      layout,
    };

    startTransition(async () => {
      try {
        if (isEdit && existing) {
          await updateInvoiceAndRedirect(existing.id, input);
        } else {
          await createInvoiceAndRedirect(input);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "An error occurred");
      }
    });
  };

  const isSentEdit = isEdit && existing && existing.status !== "draft";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">
          {isEdit ? "Edit Invoice" : "New Invoice"}
        </h1>
        <a href="/invoices" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
          ← Back to Invoices
        </a>
      </div>

      {/* Warning for non-draft edit */}
      {isSentEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Invoice Already Sent</p>
            <p className="text-xs text-amber-600 mt-0.5">
              This invoice has been sent. Editing is restricted to draft invoices only.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-stone-900">Invoice Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer */}
          <div className="md:col-span-2 relative">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              Customer <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
                if (!e.target.value) setCustomerId("");
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
              placeholder="Search customer…"
              disabled={!!isSentEdit}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 disabled:bg-gray-50"
            />
            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.slice(0, 10).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-amber-700/5 transition-colors"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerSearch(c.full_name || "");
                      setShowCustomerDropdown(false);
                    }}
                  >
                    <span className="font-medium text-stone-900">{c.full_name}</span>
                    {c.email && <span className="text-stone-400 ml-2">{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Invoice Date */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              disabled={!!isSentEdit}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 disabled:bg-gray-50"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!!isSentEdit}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 disabled:bg-gray-50"
            />
          </div>

          {/* Reference Type */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Reference Type</label>
            <select
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value)}
              disabled={!!isSentEdit}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 disabled:bg-gray-50"
            >
              {REFERENCE_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Line Items</h2>
          {!isSentEdit && inventoryItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInventorySearch(!showInventorySearch)}
              className="text-xs text-amber-700 hover:text-amber-700/80 font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Add from Inventory
            </button>
          )}
        </div>

        {/* Inventory search panel */}
        {showInventorySearch && (
          <div className="border border-stone-200 rounded-lg p-3 bg-stone-900/2">
            <input
              type="text"
              placeholder="Search inventory…"
              value={inventoryQuery}
              onChange={(e) => setInventoryQuery(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 mb-2"
              autoFocus
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredInventory.slice(0, 20).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addFromInventory(item)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-700/5 rounded-lg transition-colors flex items-center justify-between"
                >
                  <span className="text-stone-900 font-medium">{item.name}</span>
                  <span className="text-stone-500">{item.retail_price ? fmt(item.retail_price) : "—"}</span>
                </button>
              ))}
              {filteredInventory.length === 0 && (
                <p className="text-sm text-stone-400 text-center py-3">No items found</p>
              )}
            </div>
          </div>
        )}

        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-2 pr-3 font-medium text-stone-500 text-xs uppercase tracking-wider">
                  Description
                </th>
                <th className="text-right py-2 px-3 font-medium text-stone-500 text-xs uppercase tracking-wider w-20">
                  Qty
                </th>
                <th className="text-right py-2 px-3 font-medium text-stone-500 text-xs uppercase tracking-wider w-28">
                  Unit Price
                </th>
                <th className="text-right py-2 px-3 font-medium text-stone-500 text-xs uppercase tracking-wider w-20">
                  Disc %
                </th>
                <th className="text-right py-2 px-3 font-medium text-stone-500 text-xs uppercase tracking-wider w-28">
                  Total
                </th>
                {!isSentEdit && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-platinum/50">
              {lineItems.map((item) => {
                const disc = item.discount_pct ? item.discount_pct / 100 : 0;
                const rowTotal = item.quantity * item.unit_price * (1 - disc);
                return (
                  <tr key={item.id}>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                        placeholder="Item description…"
                        disabled={!!isSentEdit}
                        className="w-full px-2 py-1.5 border border-transparent hover:border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 disabled:bg-transparent"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        disabled={!!isSentEdit}
                        className="w-full px-2 py-1.5 border border-transparent hover:border-stone-200 rounded-lg text-sm text-right text-stone-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 disabled:bg-transparent"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                        disabled={!!isSentEdit}
                        className="w-full px-2 py-1.5 border border-transparent hover:border-stone-200 rounded-lg text-sm text-right text-stone-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 disabled:bg-transparent"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.discount_pct || ""}
                        onChange={(e) => updateLineItem(item.id, "discount_pct", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        disabled={!!isSentEdit}
                        className="w-full px-2 py-1.5 border border-transparent hover:border-stone-200 rounded-lg text-sm text-right text-stone-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 disabled:bg-transparent"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-stone-900">
                      {fmt(rowTotal)}
                    </td>
                    {!isSentEdit && (
                      <td className="py-2 pl-2">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveLineItem(item.id, "up")}
                            disabled={lineItems.indexOf(item) === 0}
                            aria-label="Move line up"
                            className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors rounded disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLineItem(item.id, "down")}
                            disabled={lineItems.indexOf(item) === lineItems.length - 1}
                            aria-label="Move line down"
                            className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors rounded disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            aria-label="Remove line"
                            className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-red-400 transition-colors rounded"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isSentEdit && (
          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-700/80 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Line Item
          </button>
        )}

        {/* Totals */}
        <div className="border-t border-stone-200 pt-4 space-y-2">
          {/* Tax settings */}
          {!isSentEdit && (
            <div className="flex items-center gap-4 pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <label className="text-xs text-stone-500">Tax:</label>
                <input
                  type="text"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  className="w-16 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 focus:outline-none focus:border-amber-600"
                />
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-stone-200 rounded text-xs text-right text-stone-900 focus:outline-none focus:border-amber-600"
                />
                <span className="text-xs text-stone-400">({(taxRate * 100).toFixed(0)}%)</span>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxInclusive}
                  onChange={(e) => setTaxInclusive(e.target.checked)}
                  className="rounded border-stone-200 text-amber-700 focus:ring-amber-600/30"
                />
                Tax inclusive
              </label>
            </div>
          )}

          <div className="ml-auto max-w-xs space-y-1.5">
            <div className="flex justify-between text-sm text-stone-900/70">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-900/70">
              <span>{taxName} ({(taxRate * 100).toFixed(0)}%{taxInclusive ? " incl." : ""})</span>
              <span>{fmt(taxAmount)}</span>
            </div>
            {!isSentEdit ? (
              <div className="flex items-center justify-between text-sm text-stone-900/70">
                <span>Discount</span>
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount || ""}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-24 px-2 py-1 border border-stone-200 rounded text-sm text-right text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>
            ) : discountAmount > 0 ? (
              <div className="flex justify-between text-sm text-stone-900/70">
                <span>Discount</span>
                <span>−{fmt(discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between font-semibold text-stone-900 border-t border-stone-200 pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">{fmt(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes & Footer */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-stone-900">Notes & Footer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              Notes to Customer
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!!isSentEdit}
              rows={3}
              placeholder="Thank you for your business…"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              Footer / Payment Instructions
            </label>
            <textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              disabled={!!isSentEdit}
              rows={3}
              placeholder="Bank details, payment instructions…"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* PDF Layout */}
      {!isSentEdit && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-stone-900">PDF Layout</h2>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { value: "classic", label: "Classic", desc: "Logo left · accent header · shaded rows" },
                { value: "modern",  label: "Modern",  desc: "Dark header band · bold accent accents" },
                { value: "minimal", label: "Minimal", desc: "Editorial · spacious · no fills" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLayout(opt.value)}
                className={`relative p-3 rounded-lg border-2 text-left transition-all ${
                  layout === opt.value
                    ? "border-amber-600 bg-amber-50"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                {/* Mini preview */}
                <div className="mb-2.5 rounded overflow-hidden border border-stone-100 bg-white h-16">
                  {opt.value === "classic" && (
                    <div className="h-full p-1.5">
                      <div className="flex justify-between items-start mb-1">
                        <div className="space-y-0.5">
                          <div className="w-6 h-1 bg-stone-400 rounded" />
                          <div className="w-10 h-0.5 bg-stone-200 rounded" />
                        </div>
                        <div className="space-y-0.5 items-end flex flex-col">
                          <div className="w-8 h-1.5 bg-amber-600 rounded" />
                          <div className="w-5 h-0.5 bg-stone-300 rounded" />
                        </div>
                      </div>
                      <div className="h-px bg-amber-600 rounded mb-1" />
                      <div className="space-y-0.5">
                        <div className="w-full h-0.5 bg-stone-200 rounded" />
                        <div className="w-full h-0.5 bg-stone-100 rounded" />
                        <div className="w-3/4 h-0.5 bg-stone-200 rounded" />
                      </div>
                    </div>
                  )}
                  {opt.value === "modern" && (
                    <div className="h-full">
                      <div className="bg-stone-800 px-1.5 py-1.5 flex justify-between items-center">
                        <div className="space-y-0.5">
                          <div className="w-8 h-1 bg-white rounded opacity-80" />
                          <div className="w-5 h-0.5 bg-stone-500 rounded" />
                        </div>
                        <div className="space-y-0.5 items-end flex flex-col">
                          <div className="w-6 h-1.5 bg-amber-500 rounded" />
                          <div className="w-4 h-0.5 bg-stone-500 rounded" />
                        </div>
                      </div>
                      <div className="p-1.5 space-y-0.5">
                        <div className="w-full h-0.5 bg-stone-200 rounded" />
                        <div className="w-full h-0.5 bg-stone-100 rounded" />
                        <div className="w-3/4 h-0.5 bg-stone-200 rounded" />
                      </div>
                    </div>
                  )}
                  {opt.value === "minimal" && (
                    <div className="h-full p-1.5">
                      <div className="flex justify-between items-start mb-2">
                        <div className="space-y-0.5">
                          <div className="w-8 h-0.5 bg-stone-300 rounded" />
                          <div className="w-5 h-0.5 bg-stone-200 rounded" />
                        </div>
                        <div className="space-y-1 items-end flex flex-col">
                          <div className="w-4 h-0.5 bg-amber-500 rounded" />
                          <div className="w-10 h-1.5 bg-stone-800 rounded" />
                        </div>
                      </div>
                      <div className="h-px bg-stone-200 mb-1" />
                      <div className="space-y-0.5">
                        <div className="w-full h-0.5 bg-stone-100 rounded" />
                        <div className="w-3/4 h-0.5 bg-stone-100 rounded" />
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-stone-900">{opt.label}</p>
                <p className="text-[10px] text-stone-400 leading-tight mt-0.5">{opt.desc}</p>
                {layout === opt.value && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-amber-600 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!isSentEdit && (
        <div className="flex items-center justify-end gap-3 pb-6">
          <a
            href="/invoices"
            className="px-4 py-2 text-sm border border-stone-900 text-stone-900 rounded-lg hover:bg-stone-900/5 transition-colors"
          >
            Cancel
          </a>
          <button
            type="button"
            disabled={!hydrated || isPending}
            onClick={() => handleSubmit("draft")}
            className="px-4 py-2 text-sm border border-stone-900 text-stone-900 rounded-lg hover:bg-stone-900/5 transition-colors disabled:opacity-50"
          >
            {!hydrated ? "Preparing…" : isPending ? "Saving…" : "Save as Draft"}
          </button>
          <button
            type="button"
            disabled={!hydrated || isPending}
            onClick={() => handleSubmit("sent")}
            className="px-4 py-2 text-sm bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
          >
            {!hydrated ? "Preparing…" : isPending ? "Saving…" : "Save & Send"}
          </button>
        </div>
      )}
    </div>
  );
}
