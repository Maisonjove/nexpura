"use client";

import { useState, useTransition } from "react";
import { approveAccess } from "../../actions";

interface Props {
  token: string;
  requestId: string;
  businessName: string;
  requestedByEmail: string;
  reason: string | null;
}

export default function ApproveClient({ token, requestId, businessName, requestedByEmail, reason }: Props) {
  const [isPending, startTransition] = useTransition();
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveAccess(token);
      if (result.error) {
        setError(result.error);
      } else {
        setApproved(true);
      }
    });
  };

  if (approved) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Access Granted</h1>
          <p className="text-stone-500 mb-4">
            You've granted Nexpura support team temporary access to your dashboard.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left mb-6">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Access expires in 24 hours</p>
                <p className="text-xs text-amber-600 mt-1">
                  You can revoke access anytime from Settings → Security in your dashboard.
                </p>
              </div>
            </div>
          </div>
          <a
            href="/dashboard"
            className="inline-block px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Approve Support Access</h1>
          <p className="text-stone-500 text-sm">
            Nexpura support team is requesting temporary access to your dashboard.
          </p>
        </div>

        {/* Details */}
        <div className="space-y-4 mb-6">
          <div className="bg-stone-50 rounded-lg p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Your Business</p>
            <p className="text-base font-medium text-stone-900">{businessName}</p>
          </div>

          <div className="bg-stone-50 rounded-lg p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Requested By</p>
            <p className="text-base font-medium text-stone-900">{requestedByEmail}</p>
          </div>

          {reason && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs text-amber-700 uppercase tracking-wide font-medium mb-1">Reason for Access</p>
              <p className="text-sm text-amber-900">{reason}</p>
            </div>
          )}

          <div className="bg-stone-50 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-stone-700">Access Duration: 24 hours</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  Access will automatically expire. You can revoke it anytime from Settings.
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href={`/support-access/deny/${token}`}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors text-center"
          >
            Deny Request
          </a>
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isPending ? "Approving..." : "Approve Access"}
          </button>
        </div>
      </div>
    </div>
  );
}
