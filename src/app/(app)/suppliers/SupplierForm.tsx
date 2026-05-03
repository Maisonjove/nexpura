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
  tax_id?: string | null;
  payment_terms?: string | null;
}

const PAYMENT_TERMS = [
  { value: "", label: "—" },
  { value: "due_on_receipt", label: "Due on receipt" },
  { value: "net_7", label: "Net 7 days" },
  { value: "net_14", label: "Net 14 days" },
  { value: "net_30", label: "Net 30 days" },
  { value: "net_60", label: "Net 60 days" },
  { value: "prepaid", label: "Prepaid" },
  { value: "cod", label: "Cash on delivery" },
];

// Tax-ID validators by jurisdiction. Tenants in AU use 11-digit ABN
// (most common); we also accept a generic alphanumeric fallback so
// tenants in NZ / US / EU aren't blocked. Checksum is validated for
// the AU 11-digit case via the published modulus-89 algorithm.
function validateAbn(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = digits.split("").reduce((acc, d, i) => {
    const n = parseInt(d, 10);
    return acc + (i === 0 ? n - 1 : n) * weights[i];
  }, 0);
  return sum % 89 === 0;
}

function validateTaxId(raw: string): { ok: boolean; reason?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true }; // optional field
  // 11 digits → assume AU ABN, run checksum
  if (/^\d[\d\s]{9,14}\d$/.test(trimmed)) {
    if (!validateAbn(trimmed)) {
      return { ok: false, reason: "11-digit value looks like an Australian ABN but checksum failed." };
    }
    return { ok: true };
  }
  // Generic fallback: 6-20 alphanumeric chars (covers EIN, VAT, GST etc.)
  if (!/^[A-Za-z0-9\- ]{6,20}$/.test(trimmed)) {
    return { ok: false, reason: "Tax ID must be 6-20 alphanumeric characters." };
  }
  return { ok: true };
}

interface Props {
  mode: "create" | "edit";
  supplier?: SupplierData;
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";

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

    // Tax ID validation: optional, but if provided must pass shape +
    // (for AU 11-digit values) the ABN checksum.
    const taxIdRaw = (formData.get("tax_id") as string) || "";
    const taxCheck = validateTaxId(taxIdRaw);
    if (!taxCheck.ok) {
      setError(taxCheck.reason ?? "Invalid Tax ID");
      return;
    }

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

      <Section title="Tax & Terms">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="tax_id">Tax ID (ABN / EIN / VAT)</FieldLabel>
            <input
              id="tax_id"
              name="tax_id"
              type="text"
              defaultValue={supplier?.tax_id || ""}
              placeholder="e.g. 53 004 085 616"
              className={inputCls}
            />
            <p className="text-xs text-stone-500 mt-1">
              Optional. AU 11-digit ABNs are checksum-validated.
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="payment_terms">Payment Terms</FieldLabel>
            <select
              id="payment_terms"
              name="payment_terms"
              defaultValue={supplier?.payment_terms || ""}
              className={inputCls}
            >
              {PAYMENT_TERMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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
          className="px-6 py-2.5 text-sm font-medium bg-nexpura-charcoal text-white rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
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
