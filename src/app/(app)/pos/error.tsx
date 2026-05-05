"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

export default function RouteError({
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
    // Capturing here at the segment level ensures the event lands.
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="p-6 max-w-lg mx-auto mt-12">
      <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Failed to load this page</h2>
        <p className="text-red-600 text-sm mb-4">
          Something went wrong. Please try again.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-red-200 text-red-700 text-sm rounded-lg hover:bg-red-50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
