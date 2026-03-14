"use client";

import { useState } from "react";
import { saveSequence, type SequenceInfo } from "./actions";

interface SequenceRowProps {
  label: string;
  prefix: string;
  field: "invoice_sequence" | "job_sequence" | "repair_sequence" | "sale_sequence" | "quote_sequence";
  currentValue: number;
  currentNumber: string;
}

function SequenceRow({ label, prefix, field, currentValue, currentNumber }: SequenceRowProps) {
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const result = await saveSequence(field, value);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">{label}</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Current latest:{" "}
            <span className="font-mono text-stone-600 font-medium">
              {currentNumber}
            </span>
          </p>
        </div>
        {success && (
          <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md">
            ✓ Saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden focus-within:border-[#8B7355] focus-within:ring-2 focus-within:ring-[#8B7355]/20 transition-all">
          <span className="px-3 py-2 bg-stone-50 text-stone-500 text-sm font-mono border-r border-stone-200 whitespace-nowrap">
            {prefix}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={value}
            onChange={(e) => setValue(parseInt(e.target.value) || 1)}
            className="w-28 px-3 py-2 text-sm font-mono bg-white text-stone-900 focus:outline-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>

      <p className="text-xs text-stone-400">
        Next document will be:{" "}
        <span className="font-mono text-stone-600">
          {prefix}{String(value).padStart(4, "0")}
        </span>
      </p>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────

interface Props {
  initialData: SequenceInfo | null;
}

export default function NumberingClient({ initialData }: Props) {
  if (!initialData) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-8 text-center text-sm text-stone-500">
        Could not load numbering configuration. Please refresh the page.
      </div>
    );
  }

  const rows: SequenceRowProps[] = [
    {
      label: "Invoice Number",
      prefix: "INV-",
      field: "invoice_sequence",
      currentValue: initialData.invoice_sequence,
      currentNumber: initialData.invoice_current,
    },
    {
      label: "Bespoke Job Number",
      prefix: "JOB-",
      field: "job_sequence",
      currentValue: initialData.job_sequence,
      currentNumber: initialData.job_current,
    },
    {
      label: "Repair Ticket Number",
      prefix: "REP-",
      field: "repair_sequence",
      currentValue: initialData.repair_sequence,
      currentNumber: initialData.repair_current,
    },
    {
      label: "Sale Number",
      prefix: "SALE-",
      field: "sale_sequence",
      currentValue: initialData.sale_sequence,
      currentNumber: initialData.sale_current,
    },
    {
      label: "Quote Number",
      prefix: "QUO-",
      field: "quote_sequence",
      currentValue: initialData.quote_sequence,
      currentNumber: initialData.quote_current,
    },
  ];

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <SequenceRow key={row.field} {...row} />
      ))}
    </div>
  );
}
