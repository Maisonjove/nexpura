"use client";

import { useState, useTransition } from "react";
import { denyAccess } from "../../actions";

interface Props {
  token: string;
  businessName: string;
  requestedByEmail: string;
}

export default function DenyClient({ token, businessName, requestedByEmail }: Props) {
  const [isPending, startTransition] = useTransition();
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeny = () => {
    setError(null);
    startTransition(async () => {
      const result = await denyAccess(token);
      if (result.error) {
        setError(result.error);
      } else {
        setDenied(true);
      }
    });
  };

  if (denied) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Request Denied</h1>
          <p className="text-stone-500 mb-6">
            You've denied the support access request. No access has been granted.
          </p>
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
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Deny Support Access?</h1>
          <p className="text-stone-500 text-sm">
            Are you sure you want to deny this support access request?
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
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href={`/support-access/approve/${token}`}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-center"
          >
            Approve Instead
          </a>
          <button
            onClick={handleDeny}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending ? "Denying..." : "Deny Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
