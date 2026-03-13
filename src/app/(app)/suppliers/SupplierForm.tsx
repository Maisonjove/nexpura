"use client";

import { useState, useTransition } from "react";
import { createSupplier, updateSupplier } from "./actions";

interface SupplierData {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
}

interface Props {
  mode: "create" | "edit";
  supplier?: SupplierData;
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]";

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

export default function SupplierForm({ mode, supplier }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createSupplier(formData);
        if (result?.error) setError(result.error);
      } else if (supplier) {
        const result = await updateSupplier(supplier.id, formData);
        if (result?.error) setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Supplier Details">
        <div>
          <FieldLabel htmlFor="name" required>
            Supplier Name
          </FieldLabel>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={supplier?.name || ""}
            placeholder="e.g. Gold & Silver Supplies Co."
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="contact_name">Contact Name</FieldLabel>
            <input
              id="contact_name"
              name="contact_name"
              type="text"
              defaultValue={supplier?.contact_name || ""}
              placeholder="e.g. John Smith"
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={supplier?.phone || ""}
              placeholder="+61 4XX XXX XXX"
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={supplier?.email || ""}
              placeholder="contact@supplier.com"
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel htmlFor="website">Website</FieldLabel>
            <input
              id="website"
              name="website"
              type="url"
              defaultValue={supplier?.website || ""}
              placeholder="https://supplier.com"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      <Section title="Address & Notes">
        <div>
          <FieldLabel htmlFor="address">Address</FieldLabel>
          <textarea
            id="address"
            name="address"
            defaultValue={supplier?.address || ""}
            rows={3}
            placeholder="Street address, city, state, postcode…"
            className={`${inputCls} resize-none`}
          />
        </div>
        <div>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <textarea
            id="notes"
            name="notes"
            defaultValue={supplier?.notes || ""}
            rows={3}
            placeholder="Lead times, terms, product categories…"
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
          href="/suppliers"
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
              ? "Adding…"
              : "Saving…"
            : mode === "create"
            ? "Add Supplier"
            : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
