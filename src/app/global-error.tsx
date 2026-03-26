"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error details for debugging
    console.error('[GlobalError]', error.name, error.message, error.stack);
    Sentry.captureException(error);
  }, [error]);

  // Show error details in development or when there's a digest
  const showDetails = process.env.NODE_ENV === 'development' || error.digest;

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              Something went wrong!
            </h2>
            <p className="mb-4 text-gray-600">
              We&apos;ve been notified about this issue and are working to fix it.
            </p>
            {showDetails && (
              <div className="mb-4 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 overflow-auto max-h-32">
                <div><strong>Error:</strong> {error.message}</div>
                {error.digest && <div><strong>Digest:</strong> {error.digest}</div>}
              </div>
            )}
            <button
              onClick={() => reset()}
              className="w-full rounded-md bg-gray-900 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
