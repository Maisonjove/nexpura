"use client";

import { useState, useTransition } from "react";
import { requestSupportAccess } from "../actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
}

export default function RequestAccessModal({ isOpen, onClose, tenantId, tenantName }: Props) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await requestSupportAccess(tenantId, reason.trim() || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setReason("");
        }, 2000);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-stone-200">
        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">Request Sent!</h3>
            <p className="text-stone-500 text-sm">Email sent to {tenantName}. You'll be notified when they respond.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-stone-900">Request Support Access</h3>
              <button
                onClick={onClose}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <div className="bg-stone-50 rounded-lg p-4 mb-4 border border-stone-100">
                  <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Requesting access to</p>
                  <p className="text-base font-medium text-stone-900">{tenantName}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                    Reason for Access <span className="text-stone-400">(optional)</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Investigating reported issue with invoices..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20 bg-white resize-none"
                  />
                </div>

                <div className="mt-4 bg-stone-50 border border-stone-200 rounded-lg p-3">
                  <div className="flex gap-2">
                    <svg className="w-5 h-5 text-stone-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-stone-700">Access Duration: 24 hours</p>
                      <p className="text-xs text-stone-500 mt-0.5">Access will automatically expire. The tenant can revoke at any time.</p>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
