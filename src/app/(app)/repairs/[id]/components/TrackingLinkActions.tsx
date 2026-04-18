"use client";

import { useState } from "react";

interface Props {
  trackingId: string;
  onCopied?: () => void;
}

export default function TrackingLinkActions({ trackingId, onCopied }: Props) {
  const [copied, setCopied] = useState(false);
  const href = `/track/${trackingId}`;

  const handleCopy = async () => {
    const absolute =
      typeof window !== "undefined"
        ? new URL(href, window.location.origin).toString()
        : href;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / permission-denied: select-and-copy via textarea
      const ta = document.createElement("textarea");
      ta.value = absolute;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      document.body.removeChild(ta);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 transition-colors"
        title="Open the customer tracking page in a new tab"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        Customer Tracking
        <span className="ml-1 font-mono text-[10px] text-amber-600/70">{trackingId}</span>
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:border-stone-300 rounded-lg px-3 py-1.5 transition-colors"
        title="Copy the customer tracking link to clipboard"
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  );
}
