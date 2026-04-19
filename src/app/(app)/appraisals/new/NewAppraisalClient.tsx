"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAppraisal } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  customers: Customer[];
}

export default function NewAppraisalClient({ customers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await createAppraisal(fd);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/appraisals/${result.id}`);
      } catch (err) {
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : "Save failed. Please try again.");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/appraisals"
        className="text-sm text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1"
      >
        ← Back to Appraisals
      </Link>
      <h1 className="text-2xl font-semibold text-stone-900 mt-4 mb-8">New Appraisal</h1>

      <form onSubmit={handleSubmit}>
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Client Details */}
          <div>
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              Client Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Customer</label>
                <select
                  name="customer_id"
                  onChange={(e) => {
                    const c = customers.find((c) => c.id === e.target.value);
                    setSelectedCustomer(c ?? null);
                  }}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                >
                  <option value="">Select or enter manually…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="customer_name"
                  required
                  defaultValue={
                    selectedCustomer
                      ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                      : ""
                  }
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Email</label>
                <input
                  name="customer_email"
                  type="email"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Phone</label>
                <input
                  name="customer_phone"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
            </div>
          </div>

          {/* Item Details */}
          <div>
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              Item Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-stone-700 block mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="item_name"
                  required
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                  placeholder="e.g. 18ct Yellow Gold Diamond Solitaire Ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Metal</label>
                <input
                  name="metal"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                  placeholder="18ct Yellow Gold…"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">
                  Purity / Hallmark
                </label>
                <input
                  name="metal_purity"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                  placeholder="750, 925, 999…"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Stone</label>
                <input
                  name="stone"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                  placeholder="Diamond, Ruby…"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Stone Carat</label>
                <input
                  name="stone_carat"
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Condition</label>
                <select
                  name="condition"
                  defaultValue="good"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                >
                  <option value="excellent">Excellent</option>
                  <option value="very_good">Very Good</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Hallmarks</label>
                <input
                  name="hallmarks"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
            </div>
          </div>

          {/* Appraisal Details */}
          <div>
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              Appraisal
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Type</label>
                <select
                  name="appraisal_type"
                  defaultValue="insurance"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                >
                  <option value="insurance">Insurance</option>
                  <option value="estate">Estate</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="damage">Damage Assessment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">
                  Appraisal Date
                </label>
                <input
                  name="appraisal_date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">
                  Appraised Value (AUD)
                </label>
                <input
                  name="appraised_value"
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">
                  Replacement Value (AUD)
                </label>
                <input
                  name="replacement_value"
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">
                  Appraiser Name
                </label>
                <input
                  name="appraiser_name"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">
                  Licence / Qualifications
                </label>
                <input
                  name="appraiser_licence"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Fee (AUD)</label>
                <input
                  name="fee"
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Valid Until</label>
                <input
                  name="valid_until"
                  type="date"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-stone-700 block mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-stone-100">
            <SubmitButton
              isPending={isPending}
              idleLabel="Create Appraisal"
              pendingLabel="Creating…"
              className="px-5 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50"
            />
            <Link
              href="/appraisals"
              className="px-4 py-2.5 border border-stone-200 text-stone-600 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
