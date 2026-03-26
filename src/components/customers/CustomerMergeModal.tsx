"use client";

import { useState } from "react";
import { X, AlertTriangle, Check, Users, ArrowRight } from "lucide-react";

interface Customer {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  tags: string[] | null;
  is_vip: boolean | null;
  created_at: string;
}

interface CustomerMergeModalProps {
  customers: Customer[];
  onClose: () => void;
  onMerge: (primaryId: string, secondaryIds: string[]) => Promise<void>;
}

export default function CustomerMergeModal({
  customers,
  onClose,
  onMerge,
}: CustomerMergeModalProps) {
  const [primaryId, setPrimaryId] = useState<string>(customers[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryCustomer = customers.find((c) => c.id === primaryId);
  const secondaryCustomers = customers.filter((c) => c.id !== primaryId);

  async function handleMerge() {
    if (!primaryId || secondaryCustomers.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      await onMerge(
        primaryId,
        secondaryCustomers.map((c) => c.id)
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge customers");
    } finally {
      setLoading(false);
    }
  }

  function getDisplayName(customer: Customer) {
    return (
      customer.full_name ||
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      "Unknown"
    );
  }

  function getInitials(customer: Customer) {
    const name = getDisplayName(customer);
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Merge Customers</h2>
              <p className="text-sm text-stone-500">
                Combine {customers.length} customer records into one
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  This action cannot be undone
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  All purchase history, repairs, invoices, and notes from merged
                  customers will be transferred to the primary record.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Select Primary */}
          <div>
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-3">
              Select Primary Customer (will be kept)
            </label>
            <div className="space-y-2">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => setPrimaryId(customer.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    primaryId === customer.id
                      ? "border-amber-500 bg-amber-50"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold ${
                      primaryId === customer.id
                        ? "bg-amber-200 text-amber-800"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {getInitials(customer)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-stone-900">
                        {getDisplayName(customer)}
                      </p>
                      {customer.is_vip && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          VIP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-stone-500">
                      {customer.email && <span>{customer.email}</span>}
                      {customer.mobile && <span>{customer.mobile}</span>}
                    </div>
                    <p className="text-xs text-stone-400 mt-1">
                      Created{" "}
                      {new Date(customer.created_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      primaryId === customer.id
                        ? "border-amber-500 bg-amber-500"
                        : "border-stone-300"
                    }`}
                  >
                    {primaryId === customer.id && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Merge Preview */}
          {primaryCustomer && secondaryCustomers.length > 0 && (
            <div className="bg-stone-50 rounded-xl p-4">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
                Merge Preview
              </p>
              <div className="flex items-center gap-4">
                {/* Secondary customers */}
                <div className="flex-1 space-y-2">
                  {secondaryCustomers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 text-sm text-stone-600"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-medium text-red-700">
                        {getInitials(c)}
                      </div>
                      <span className="line-through">{getDisplayName(c)}</span>
                      <span className="text-xs text-red-500">(will be removed)</span>
                    </div>
                  ))}
                </div>

                <ArrowRight className="h-5 w-5 text-stone-400" />

                {/* Primary customer */}
                <div className="flex items-center gap-2 text-sm text-stone-900 font-medium">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-medium text-emerald-700">
                    {getInitials(primaryCustomer)}
                  </div>
                  <span>{getDisplayName(primaryCustomer)}</span>
                </div>
              </div>
            </div>
          )}

          {/* What will be merged */}
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
              Data that will be merged:
            </p>
            <ul className="text-sm text-stone-600 space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Purchase history & sales
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Repair & bespoke jobs
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Invoices & payments
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Notes & communications
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Tags & preferences
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 text-stone-700 font-medium rounded-lg hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={loading || !primaryId || secondaryCustomers.length === 0}
            className="flex-1 bg-amber-700 text-white font-medium py-2.5 rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
          >
            {loading ? "Merging..." : `Merge ${customers.length} Customers`}
          </button>
        </div>
      </div>
    </div>
  );
}
