"use client";

import { useEffect, useState } from "react";

/**
 * Progressive-render hook.
 *
 * Problem: hydrating 200 table rows at once blocks the main thread for
 * 200-500 ms on mid-range devices — the user sees a frozen shell right
 * after the HTML arrives. Even with precomputed data and shell-first
 * streaming, React has to reconcile every row before anything is
 * interactive.
 *
 * Fix: start by rendering the first `initialCount` rows (default 40 —
 * ~1 viewport), then yield back to the browser to paint. After paint,
 * add the next `batchSize` rows every animation frame until the full
 * `totalCount` is rendered. User sees rows instantly, rest fills in
 * without blocking interaction on the already-visible rows.
 *
 * Returns the current render-cap. Callers slice their list to
 * `list.slice(0, cap)`.
 */
export function useProgressiveRender(
  totalCount: number,
  options: { initialCount?: number; batchSize?: number } = {}
): number {
  const { initialCount = 40, batchSize = 40 } = options;
  const [cap, setCap] = useState(() => Math.min(initialCount, totalCount));

  useEffect(() => {
    if (cap >= totalCount) return;
    // Schedule the next batch for after the current paint. rAF yields to
    // the browser so the first batch paints before we reconcile more rows.
    const raf = requestAnimationFrame(() => {
      setCap((c) => Math.min(c + batchSize, totalCount));
    });
    return () => cancelAnimationFrame(raf);
  }, [cap, totalCount, batchSize]);

  // If the list shrinks (filter change), clamp the cap down so we don't
  // show stale slots.
  useEffect(() => {
    if (cap > totalCount) setCap(totalCount);
  }, [cap, totalCount]);

  return cap;
}
