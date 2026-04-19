"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createMemoItem } from "../actions";
import { ArrowLeft } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface Props {
  memoType: "memo" | "consignment";
  customers: Customer[];
  suppliers: Supplier[];
}

export default function NewMemoClient({ memoType, customers, suppliers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isMemo = memoType === "memo";
  const title = isMemo ? "New Memo" : "New Consignment";
  const contactLabel = isMemo ? "Customer" : "Supplier";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("memo_type", memoType);

    startTransition(async () => {
      try {
        const result = await createMemoItem(fd);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push("/memo");
      } catch (err) {
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : "Save failed. Please try again.");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/memo"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Memo/Consignment
      </Link>

      {/* Header */}
      <h1 className="text-2xl font-semibold text-stone-900 mb-8">{title}</h1>

      {/* Form Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Item Name */}
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">
              Item Name *
            </label>
            <input
              name="item_name"
              required
              placeholder="e.g. 18K Gold Ring with Diamond"
              className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Value and Commission - 2 column */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                Retail Value ($) *
              </label>
              <input
                name="retail_value"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                Commission (%)
              </label>
              <input
                name="commission_rate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue="20"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Contact Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">
              {contactLabel}
            </label>
            {isMemo ? (
              <select
                name="customer_id"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.email ? ` (${c.email})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <select
                name="supplier_id"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Due Back Date */}
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">
              Due Back Date
            </label>
            <input
              name="due_back_date"
              type="date"
              className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Any additional details..."
              className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton
              isPending={isPending}
              idleLabel={`Create ${isMemo ? "Memo" : "Consignment"}`}
              pendingLabel="Creating..."
              className="flex-1 py-3 bg-amber-700 text-white rounded-xl text-sm font-semibold hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Link
              href="/memo"
              className="px-6 py-3 border border-stone-200 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
