'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
          <h1 className="text-4xl font-bold text-stone-900">Something went wrong</h1>
          <p className="text-stone-500 max-w-md">
            {error.message || 'An unexpected error occurred. Please try again or return to the homepage.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 border border-stone-200 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50"
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
