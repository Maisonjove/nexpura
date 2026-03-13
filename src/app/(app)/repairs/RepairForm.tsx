"use client";

import { useState, useTransition } from "react";
import { createRepair, updateRepair } from "./actions";

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const ITEM_TYPES = [
  "Ring",
  "Bracelet",
  "Necklace",
  "Earrings",
  "Pendant",
  "Watch",
  "Brooch",
  "Other",
];

const REPAIR_TYPES = [
  "Ring resize",
  "Stone replacement",
  "Clasp repair",
  "Chain repair",
  "Prong re-tipping",
  "Polishing & cleaning",
  "Rhodium plating",
  "Engraving",
  "Stone setting",
  "Soldering",
  "Other",
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  full_name: string | null;
}

interface RepairData {
  id: string;
  repair_number: string;
  customer_id: string | null;
  item_type: string;
  item_description: string;
  metal_type: string | null;
  brand: string | null;
  condition_notes: string | null;
  repair_type: string;
  work_description: string | null;
  priority: string;
  due_date: string | null;
  quoted_price: number | null;
  final_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  internal_notes: string | null;
  client_notes: string | null;
}

interface Props {
  customers: Customer[];
  mode: "create" | "edit";
  repair?: RepairData;
}

// ────────────────────────────────────────────────────────────────
// Form Section wrapper
// ────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-stone-900">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Field helpers
// ────────────────────────────────────────────────────────────────

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
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-stone-900 mb-1"
    >
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]";

const selectCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]";

// ────────────────────────────────────────────────────────────────
// Customer Search
// ────────────────────────────────────────────────────────────────

function CustomerSearch({
  customers,
  defaultCustomerId,
}: {
  customers: Customer[];
  defaultCustomerId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(
    customers.find((c) => c.id === defaultCustomerId) || null
  );
  const [open, setOpen] = useState(false);

  const filtered = search
    ? customers.filter((c) =>
        c.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : customers.slice(0, 8);

  return (
    <div className="relative">
      <input type="hidden" name="customer_id" value={selected?.id || ""} />
      {selected ? (
        <div className="flex items-center justify-between px-3 py-2 bg-white border border-[#8B7355]/40 rounded-lg">
          <span className="text-sm font-medium text-stone-900">
            {selected.full_name}
          </span>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-stone-400 hover:text-stone-900 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search customers…"
            className={inputCls}
          />
          {open && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-stone-400">
                  No customers found
                </p>
              ) : (
                <ul>
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(c);
                          setSearch("");
                          setOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-stone-900 hover:bg-stone-50 transition-colors"
                      >
                        {c.full_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Form Component
// ────────────────────────────────────────────────────────────────

export default function RepairForm({ customers, mode, repair }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createRepair(formData);
        if (result?.error) setError(result.error);
      } else if (repair) {
        const result = await updateRepair(repair.id, formData);
        if (result?.error) setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── 1. Customer ─────────────────────────────────────── */}
      <Section title="Customer">
        <div>
          <FieldLabel htmlFor="customer_search">Customer</FieldLabel>
          <CustomerSearch
            customers={customers}
            defaultCustomerId={repair?.customer_id || null}
          />
          <p className="text-xs text-stone-400 mt-1">
            Optional — leave blank for walk-in
          </p>
        </div>
      </Section>

      {/* ── 2. Item Details ────────────────────────────────── */}
      <Section title="Item Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="item_type" required>
              Item Type
            </FieldLabel>
            <select
              id="item_type"
              name="item_type"
              required
              defaultValue={repair?.item_type || ""}
              className={selectCls}
            >
              <option value="">Select type…</option>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="metal_type">Metal Type</FieldLabel>
            <input
              id="metal_type"
              name="metal_type"
              type="text"
              defaultValue={repair?.metal_type || ""}
              placeholder="e.g. 18ct Yellow Gold"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="item_description" required>
            Item Description
          </FieldLabel>
          <textarea
            id="item_description"
            name="item_description"
            required
            defaultValue={repair?.item_description || ""}
            rows={3}
            placeholder="Describe the piece in detail…"
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <FieldLabel htmlFor="brand">Brand</FieldLabel>
          <input
            id="brand"
            name="brand"
            type="text"
            defaultValue={repair?.brand || ""}
            placeholder="e.g. Tiffany, Cartier"
            className={inputCls}
          />
        </div>
      </Section>

      {/* ── 3. Condition on Intake ────────────────────────── */}
      <Section title="Condition on Intake">
        <div>
          <FieldLabel htmlFor="condition_notes">Condition Notes</FieldLabel>
          <textarea
            id="condition_notes"
            name="condition_notes"
            defaultValue={repair?.condition_notes || ""}
            rows={3}
            placeholder="Describe what's damaged, worn, or missing…"
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="border-2 border-dashed border-stone-200 rounded-lg p-5 text-center">
          <svg
            className="w-8 h-8 text-stone-300 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-xs text-stone-400">Photo upload coming soon</p>
        </div>
      </Section>

      {/* ── 4. Repair Required ───────────────────────────── */}
      <Section title="Repair Required">
        <div>
          <FieldLabel htmlFor="repair_type" required>
            Repair Type
          </FieldLabel>
          <select
            id="repair_type"
            name="repair_type"
            required
            defaultValue={repair?.repair_type || ""}
            className={selectCls}
          >
            <option value="">Select repair type…</option>
            {REPAIR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="work_description">Work Description</FieldLabel>
          <textarea
            id="work_description"
            name="work_description"
            defaultValue={repair?.work_description || ""}
            rows={4}
            placeholder="Detailed instructions for the repair work…"
            className={`${inputCls} resize-none`}
          />
        </div>
      </Section>

      {/* ── 5. Timeline & Pricing ────────────────────────── */}
      <Section title="Timeline & Pricing">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="due_date">Due Date</FieldLabel>
            <input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={repair?.due_date?.split("T")[0] || ""}
              className={inputCls}
            />
          </div>

          <div>
            <FieldLabel htmlFor="priority">Priority</FieldLabel>
            <select
              id="priority"
              name="priority"
              defaultValue={repair?.priority || "normal"}
              className={selectCls}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="quoted_price">Quoted Price (£)</FieldLabel>
            <input
              id="quoted_price"
              name="quoted_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={repair?.quoted_price ?? ""}
              placeholder="0.00"
              className={inputCls}
            />
          </div>

          <div>
            <FieldLabel htmlFor="deposit_amount">
              Deposit Amount (£)
            </FieldLabel>
            <input
              id="deposit_amount"
              name="deposit_amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={repair?.deposit_amount ?? ""}
              placeholder="Optional"
              className={inputCls}
            />
          </div>
        </div>

        {mode === "edit" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="final_price">Final Price (£)</FieldLabel>
              <input
                id="final_price"
                name="final_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={repair?.final_price ?? ""}
                placeholder="0.00"
                className={inputCls}
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                id="deposit_paid"
                name="deposit_paid"
                type="checkbox"
                value="true"
                defaultChecked={repair?.deposit_paid}
                className="w-4 h-4 rounded border-stone-200 text-[#8B7355] focus:ring-[#8B7355]"
              />
              <label
                htmlFor="deposit_paid"
                className="text-sm font-medium text-stone-900"
              >
                Deposit paid
              </label>
            </div>
          </div>
        )}
      </Section>

      {/* ── 6. Notes ─────────────────────────────────────── */}
      <Section title="Notes">
        <div>
          <FieldLabel htmlFor="internal_notes">
            Internal Notes{" "}
            <span className="text-xs text-stone-400 font-normal">
              (staff only)
            </span>
          </FieldLabel>
          <textarea
            id="internal_notes"
            name="internal_notes"
            defaultValue={repair?.internal_notes || ""}
            rows={3}
            placeholder="Notes visible to staff only…"
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <FieldLabel htmlFor="client_notes">
            Client Notes / Instructions
          </FieldLabel>
          <textarea
            id="client_notes"
            name="client_notes"
            defaultValue={repair?.client_notes || ""}
            rows={3}
            placeholder="Special instructions from the client…"
            className={`${inputCls} resize-none`}
          />
        </div>
      </Section>

      {/* ── Read-only repair number (edit mode) ─────────── */}
      {mode === "edit" && repair && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
            Repair Number
          </span>
          <span className="text-sm font-mono font-medium text-stone-900 bg-stone-200 px-2 py-0.5 rounded">
            {repair.repair_number}
          </span>
          <span className="text-xs text-stone-400">(read-only)</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <a
          href="/repairs"
          className="px-5 py-2.5 text-sm font-medium text-stone-900 bg-white border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-all"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 text-sm font-medium bg-[#8B7355] text-white rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50"
        >
          {isPending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
            ? "Create Repair"
            : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
