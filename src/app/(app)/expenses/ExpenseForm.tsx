"use client";

import { useRef, useState, useTransition } from "react";
import { createExpense, updateExpense } from "./actions";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

interface ExpenseData {
  id: string;
  description: string;
  category: string;
  amount: number;
  invoice_ref: string | null;
  expense_date: string;
  notes: string | null;
  receipt_url?: string | null;
}

interface Props {
  mode: "create" | "edit";
  expense?: ExpenseData;
  /**
   * Server-resolved signed URL for the existing receipt (cleanup #18 —
   * `inventory-photos` bucket is now private). Required when editing an
   * expense that already has a receipt; resolved by the page-level data
   * fetcher via `signStoragePath`. Ignored on create.
   */
  initialReceiptDisplayUrl?: string | null;
}

const CATEGORIES = [
  { value: "stock", label: "Stock" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "marketing", label: "Marketing" },
  { value: "staffing", label: "Staffing" },
  { value: "equipment", label: "Equipment" },
  { value: "repairs", label: "Repairs" },
  { value: "other", label: "Other" },
];

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";

const selectCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";

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

export default function ExpenseForm({ mode, expense, initialReceiptDisplayUrl = null }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Two-state shape because the bucket is now private (cleanup #18):
  //   - `receiptPath` is the storage path persisted in DB (`expenses.receipt_url`,
  //     legacy column name kept for compatibility — it's now a path).
  //   - `receiptDisplayUrl` is the short-lived signed URL we render in the
  //     "View receipt" link until form submit; it expires in 1h which is
  //     fine for an upload-and-submit flow. On edit, the page-level data
  //     fetcher hands us a pre-signed display URL via prop.
  const [receiptPath, setReceiptPath] = useState<string | null>(expense?.receipt_url ?? null);
  const [receiptDisplayUrl, setReceiptDisplayUrl] = useState<string | null>(initialReceiptDisplayUrl);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  async function handleReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`Receipt is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is 10 MB.`);
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setError(`Unsupported type "${file.type}". Use JPEG/PNG/WEBP/PDF.`);
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("inventory-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      // Sign for 1h — receipt UX is "upload → glance → submit". The DB row
      // stores the bare path; server-side data fetcher re-signs on read.
      const { data, error: signErr } = await supabase.storage
        .from("inventory-photos")
        .createSignedUrl(path, 60 * 60);
      if (signErr || !data?.signedUrl) {
        setError(signErr?.message ?? "Could not generate receipt URL.");
        return;
      }
      setReceiptPath(path);
      setReceiptDisplayUrl(data.signedUrl);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("receipt_url", receiptPath ?? "");

    startTransition(async () => {
      if (mode === "create") {
        const result = await createExpense(formData);
        if (result?.error) setError(result.error);
      } else if (expense) {
        const result = await updateExpense(expense.id, formData);
        if (result?.error) setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Expense Details">
        <div>
          <FieldLabel htmlFor="description" required>
            Description
          </FieldLabel>
          <input
            id="description"
            name="description"
            type="text"
            required
            defaultValue={expense?.description || ""}
            placeholder="e.g. Gold bullion purchase, Monthly office rent"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="category" required>
              Category
            </FieldLabel>
            <select
              id="category"
              name="category"
              required
              defaultValue={expense?.category || "other"}
              className={selectCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="amount" required>
              Amount (AUD)
            </FieldLabel>
            <input
              id="amount"
              name="amount"
              type="number"
              required
              min="0.01"
              step="0.01"
              defaultValue={expense?.amount ?? ""}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="expense_date" required>
              Date
            </FieldLabel>
            <input
              id="expense_date"
              name="expense_date"
              type="date"
              required
              defaultValue={expense?.expense_date || today}
              className={inputCls}
            />
          </div>

          <div>
            <FieldLabel htmlFor="invoice_ref">Invoice / Reference</FieldLabel>
            <input
              id="invoice_ref"
              name="invoice_ref"
              type="text"
              defaultValue={expense?.invoice_ref || ""}
              placeholder="INV-001, receipt number…"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      <Section title="Receipt">
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            Upload a photo or PDF of the receipt (max 10 MB). Optional.
          </p>
          {receiptPath ? (
            <div className="flex items-center gap-3">
              {receiptDisplayUrl ? (
                <a
                  href={receiptDisplayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-amber-700 underline"
                >
                  View receipt
                </a>
              ) : (
                <span className="text-sm text-stone-500">Receipt attached</span>
              )}
              <button
                type="button"
                onClick={() => {
                  setReceiptPath(null);
                  setReceiptDisplayUrl(null);
                }}
                className="text-xs text-stone-500 hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload receipt"}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={handleReceipt}
          />
        </div>
      </Section>

      <Section title="Notes">
        <div>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <textarea
            id="notes"
            name="notes"
            defaultValue={expense?.notes || ""}
            rows={3}
            placeholder="Additional details about this expense…"
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
          href="/expenses"
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
            ? "Add Expense"
            : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
