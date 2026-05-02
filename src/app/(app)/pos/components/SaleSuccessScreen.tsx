"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Printer, Mail, FileText, ShieldCheck } from "lucide-react";
import type { SaleResult, CartItem, PaymentTab } from "./types";

interface SaleSuccessScreenProps {
  saleResult: SaleResult;
  total: number;
  change: number;
  paymentTab: PaymentTab;
  emailReceiptSending: boolean;
  emailReceiptToast: string | null;
  onNewSale: () => void;
  onPrintReceipt: () => void;
  onEmailReceipt: () => void;
}

export default function SaleSuccessScreen({
  saleResult,
  total,
  change,
  paymentTab,
  emailReceiptSending,
  emailReceiptToast,
  onNewSale,
  onPrintReceipt,
  onEmailReceipt,
}: SaleSuccessScreenProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-sm">
        {/* Success header */}
        <div className="bg-green-50 border-b border-green-100 rounded-t-2xl px-8 py-7 text-center">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          {saleResult.paymentMethod === "layby" ? (
            <>
              <h2 className="text-xl font-bold text-stone-800 flex items-center justify-center gap-2">
                Layby Created
                <CheckCircle2 className="w-5 h-5 text-nexpura-emerald-deep" strokeWidth={1.5} />
              </h2>
              <p className="text-sm font-mono text-amber-700 mt-1 font-semibold">
                {saleResult.saleNumber}
              </p>
              <p className="text-sm text-stone-600 mt-2">
                Deposit taken:{" "}
                <span className="font-bold text-stone-900">
                  ${(saleResult.depositAmount ?? 0).toFixed(2)}
                </span>
              </p>
              <p className="text-sm text-stone-600">
                Balance remaining:{" "}
                <span className="font-bold text-stone-900">
                  ${(
                    (saleResult.totalAmount ?? 0) - (saleResult.depositAmount ?? 0)
                  ).toFixed(2)}
                </span>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-nexpura-emerald-deep flex items-center justify-center gap-2">
                Sale Complete
                <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
              </h2>
              <p className="text-sm font-mono text-green-700 mt-1 font-semibold">
                {saleResult.saleNumber}
              </p>
              <p className="text-3xl font-bold text-stone-900 mt-2">
                ${total.toFixed(2)}
              </p>
              {paymentTab === "cash" && change > 0 && (
                <p className="text-sm text-green-700 mt-1">
                  Change: <span className="font-bold">${change.toFixed(2)}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-5 flex flex-col gap-2.5">
          {emailReceiptToast && (
            <p
              className={`text-xs text-center font-medium py-1 ${
                emailReceiptToast.startsWith("✓") ? "text-green-600" : "text-red-500"
              }`}
            >
              {emailReceiptToast}
            </p>
          )}

          {/* Primary action: New Sale */}
          <button
            onClick={onNewSale}
            className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-base hover:bg-green-700 transition-colors"
          >
            + New Sale
          </button>

          {/* Print Receipt */}
          <button
            onClick={onPrintReceipt}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" strokeWidth={1.5} />
            Print Receipt
          </button>

          {/* Email Receipt */}
          {saleResult.invoiceId && saleResult.customerEmail && (
            <button
              onClick={onEmailReceipt}
              disabled={emailReceiptSending}
              className="w-full py-3 bg-stone-100 text-stone-900 rounded-xl font-medium hover:bg-stone-200 transition-colors disabled:opacity-50 text-sm"
            >
              {emailReceiptSending ? (
                "Sending…"
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" strokeWidth={1.5} />
                  Email to {saleResult.customerEmail}
                </span>
              )}
            </button>
          )}

          {/* View Invoice */}
          {saleResult.invoiceId && (
            <button
              onClick={() => router.push(`/invoices/${saleResult.invoiceId}`)}
              className="w-full py-3 bg-stone-100 text-stone-900 rounded-xl font-medium hover:bg-stone-200 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" strokeWidth={1.5} />
              View Invoice
            </button>
          )}

          {/* Issue Passport (finished pieces) */}
          {(saleResult.cartSnapshot ?? []).some(
            (c: CartItem) => c.itemType === "finished_piece"
          ) && (
            <button
              onClick={() => {
                const finishedItem = (saleResult.cartSnapshot ?? []).find(
                  (c: CartItem) => c.itemType === "finished_piece"
                );
                if (finishedItem)
                  router.push(
                    `/passports/new?inventory_item_id=${finishedItem.inventoryId}`
                  );
              }}
              className="w-full py-3 bg-nexpura-bronze/10 text-nexpura-bronze rounded-xl font-medium hover:bg-nexpura-bronze/20 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
              Issue Passport
            </button>
          )}

          {/* Sales History */}
          <button
            onClick={() => router.push("/sales")}
            className="w-full py-2.5 text-stone-400 rounded-xl font-medium hover:text-stone-700 transition-colors text-xs border border-stone-100 hover:border-stone-200 hover:bg-stone-50"
          >
            View Sales History →
          </button>
        </div>
      </div>
    </div>
  );
}
