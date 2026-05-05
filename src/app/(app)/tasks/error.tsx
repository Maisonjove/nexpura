'use client';
import * as Sentry from '@sentry/nextjs';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
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
        route: "tasks",
        ...(error.digest ? { digest: error.digest } : {}),
        ...(error.name ? { error_name: error.name } : {}),
      },
    });
    // Force buffered transport to drain within 2s so the event isn't
    // lost if the user navigates away before the natural flush interval.
    Sentry.flush(2000).catch(() => {});
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-center max-w-md">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
