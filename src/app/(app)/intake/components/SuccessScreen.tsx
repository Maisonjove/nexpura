"use client";

import { useRouter } from "next/navigation";
import type { Customer, SuccessResult } from "../types";

interface SuccessScreenProps {
  result: SuccessResult;
  selectedCustomer: Customer | null;
  onReset: () => void;
}

export default function SuccessScreen({
  result,
  selectedCustomer,
  onReset,
}: SuccessScreenProps) {
  const router = useRouter();

  const typeLabels = {
    repair: "Repair",
    bespoke: "Bespoke Job",
    stock: "Sale",
  };
  
  const detailPaths = {
    repair: `/repairs/${result.id}`,
    bespoke: `/bespoke/${result.id}`,
    stock: `/sales/${result.id}`,
  };
  
  const workshopPath = result.type === "stock" ? null : "/workshop";

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white border border-stone-200 rounded-2xl p-10 shadow-sm max-w-lg w-full text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-stone-900 mb-2">
          {typeLabels[result.type]} Created
        </h2>
        <p className="text-stone-500 mb-8">
          {result.type === "stock" ? "Sale" : "Job"} #{result.number} has been
          created successfully.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Print A4 Invoice */}
          <button
            onClick={() => {
              if (result.invoiceId) {
                window.open(`/api/invoice/${result.invoiceId}/pdf`, "_blank");
              } else if (result.type === "repair") {
                window.open(`/repairs/${result.id}/print`, "_blank");
              } else {
                window.print();
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors text-sm font-medium"
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
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print Invoice
          </button>

          {/* Print Thermal Receipt */}
          {result.invoiceId && (
            <button
              onClick={() => {
                window.open(
                  `/api/invoice/${result.invoiceId}/pdf?format=thermal`,
                  "_blank"
                );
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Print Receipt
            </button>
          )}

          <button
            onClick={async () => {
              if (!selectedCustomer?.email) {
                alert("Customer has no email address");
                return;
              }
              if (result.invoiceId) {
                try {
                  const res = await fetch(
                    `/api/invoices/${result.invoiceId}/email`,
                    { method: "POST" }
                  );
                  const data = await res.json();
                  if (data.error) {
                    alert(`Failed to send: ${data.error}`);
                  } else {
                    alert("Invoice emailed successfully!");
                  }
                } catch {
                  alert("Failed to send email");
                }
              } else {
                alert("No invoice to email");
              }
            }}
            disabled={!selectedCustomer?.email}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${
              selectedCustomer?.email
                ? "bg-stone-100 text-stone-700 hover:bg-stone-200"
                : "bg-stone-50 text-stone-400 cursor-not-allowed"
            }`}
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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email Customer
          </button>
        </div>

        {/* Navigation Links */}
        <div className="space-y-2">
          <button
            onClick={() => router.push(detailPaths[result.type])}
            className="w-full px-4 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors text-sm font-medium"
          >
            Go to {typeLabels[result.type]} Detail
          </button>

          {result.invoiceId && (
            <button
              onClick={() => router.push(`/invoices/${result.invoiceId}`)}
              className="w-full px-4 py-2.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              View Invoice
            </button>
          )}

          {workshopPath && (
            <button
              onClick={() => router.push(workshopPath)}
              className="w-full px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
            >
              View in Workshop
            </button>
          )}

          {selectedCustomer && (
            <button
              onClick={() => router.push(`/customers/${selectedCustomer.id}`)}
              className="w-full px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
            >
              View Customer
            </button>
          )}

          <button
            onClick={onReset}
            className="w-full px-4 py-2.5 text-amber-700 hover:text-amber-800 transition-colors text-sm font-medium"
          >
            Create Another Job →
          </button>
        </div>
      </div>
    </div>
  );
}
