"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Route Error]", error);
    // Defense-in-depth — global-error.tsx also captures, but a useEffect
    // race can miss the flush before the page nav unmounts the boundary.
    // Capturing here at the segment level + flushing the transport
    // buffer ensures the event lands even on quick nav-away.
    Sentry.captureException(error, {
      tags: {
        route: "app-root",
        ...(error.digest ? { digest: error.digest } : {}),
        ...(error.name ? { error_name: error.name } : {}),
      },
    });
    // Force buffered transport to drain within 2s so the event isn't
    // lost if the user navigates away before the natural flush interval.
    Sentry.flush(2000).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-stone-900 mb-2">Something went wrong</h2>
        <p className="text-stone-600 mb-6">
          We encountered an unexpected error. Please try again or contact support if the problem persists.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-stone-400">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
