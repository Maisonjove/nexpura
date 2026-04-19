"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer, SuccessResult } from "../types";

interface SuccessScreenProps {
  result: SuccessResult;
  selectedCustomer: Customer | null;
  onReset: () => void;
}

// Loading button component for consistent UX
function ActionButton({
  onClick,
  disabled,
  loading,
  variant = "secondary",
  children,
  icon,
}: {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline";
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading || loading) return;
    
    const result = onClick();
    if (result instanceof Promise) {
      setIsLoading(true);
      try {
        await result;
      } finally {
        setIsLoading(false);
      }
    }
  };

  const baseClasses = "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium";
  
  const variantClasses = {
    primary: "bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50",
    secondary: "bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-50",
    outline: "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50",
  };

  const showLoading = isLoading || loading;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || showLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {showLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}

export default function SuccessScreen({
  result,
  selectedCustomer,
  onReset,
}: SuccessScreenProps) {
  const router = useRouter();
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

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

  // Handle print with error handling
  const handlePrint = (format: 'a4' | 'thermal' = 'a4') => {
    try {
      if (result.invoiceId) {
        const url = format === 'thermal' 
          ? `/api/invoice/${result.invoiceId}/pdf?format=thermal`
          : `/api/invoice/${result.invoiceId}/pdf`;
        window.open(url, "_blank");
      } else if (result.type === "repair") {
        window.open(`/repairs/${result.id}/print`, "_blank");
      } else {
        window.print();
      }
    } catch (e) {
      console.error("[SuccessScreen] Print failed:", e);
      alert("Unable to open print dialog. Please try again.");
    }
  };

  // Handle email with proper async state
  const handleEmail = async () => {
    if (!selectedCustomer?.email) {
      alert("Customer has no email address");
      return;
    }
    if (!result.invoiceId) {
      alert("No invoice to email");
      return;
    }

    setEmailStatus('sending');
    setEmailError(null);

    try {
      const res = await fetch(`/api/invoices/${result.invoiceId}/email`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setEmailStatus('sent');
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send email";
      setEmailError(msg);
      setEmailStatus('error');
    }
  };

  // Handle navigation with prefetch
  const handleNavigate = (path: string) => {
    router.push(path);
  };

  // Icons
  const PrintIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );

  const ReceiptIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const EmailIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );

  const CheckIcon = (
    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

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
        <p className="text-stone-500 mb-2">
          {result.type === "stock" ? "Sale" : "Job"} <span className="font-mono font-medium">#{result.number}</span> has been created successfully.
        </p>
        
        {/* ID for debugging/support */}
        <p className="text-xs text-stone-400 mb-8 font-mono">
          ID: {result.id.slice(0, 8)}...
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Print A4 Invoice */}
          <ActionButton
            onClick={() => handlePrint('a4')}
            icon={PrintIcon}
          >
            Print Invoice
          </ActionButton>

          {/* Print Thermal Receipt - only show if invoice exists */}
          {result.invoiceId ? (
            <ActionButton
              onClick={() => handlePrint('thermal')}
              variant="secondary"
              icon={ReceiptIcon}
            >
              Print Receipt
            </ActionButton>
          ) : (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-50 text-stone-400 rounded-lg text-sm">
              {ReceiptIcon}
              <span>No Receipt</span>
            </div>
          )}

          {/* Email Customer */}
          <ActionButton
            onClick={handleEmail}
            disabled={!selectedCustomer?.email || !result.invoiceId || emailStatus === 'sent'}
            loading={emailStatus === 'sending'}
            icon={emailStatus === 'sent' ? CheckIcon : EmailIcon}
          >
            {emailStatus === 'sent' ? 'Email Sent' : 'Email Customer'}
          </ActionButton>
          
          {/* Empty cell for grid alignment when no receipt */}
          {!result.invoiceId && <div />}
        </div>

        {/* Email Error */}
        {emailStatus === 'error' && emailError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">
            {emailError}
          </div>
        )}

        {/* Customer email warning */}
        {!selectedCustomer?.email && (
          <p className="text-xs text-stone-400 mb-4">
            No customer email — email actions unavailable
          </p>
        )}

        {/* Navigation Links */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleNavigate(detailPaths[result.type])}
            className="w-full px-4 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors text-sm font-medium"
          >
            Go to {typeLabels[result.type]} Detail
          </button>

          {result.invoiceId && (
            <button
              type="button"
              onClick={() => handleNavigate(`/invoices/${result.invoiceId}`)}
              className="w-full px-4 py-2.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              {ReceiptIcon}
              View Invoice
            </button>
          )}

          {workshopPath && (
            <button
              type="button"
              onClick={() => handleNavigate(workshopPath)}
              className="w-full px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
            >
              View in Workshop
            </button>
          )}

          {selectedCustomer && (
            <button
              type="button"
              onClick={() => handleNavigate(`/customers/${selectedCustomer.id}`)}
              className="w-full px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
            >
              View Customer
            </button>
          )}

          <button
            type="button"
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
