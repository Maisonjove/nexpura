"use client";

import { useEffect, useState } from "react";

/**
 * Running date + time display in the dashboard header.
 *
 * Extracted out of DashboardClient so the ~800-line main dashboard
 * component doesn't need to keep a `useState<Date>` + a 30-second
 * `setInterval` registered as part of its hydration. This is the only
 * piece of the dashboard header that genuinely needs to be reactive;
 * everything else is static text.
 *
 * Server-renders to a placeholder (empty) to avoid hydration mismatch
 * on the initial paint, then fills in on client mount.
 */
export function DashboardClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!now) {
    // Reserve layout space via non-breaking-space characters sized to the
    // widest realistic value, but don't render any nonsense text (was
    // "Monday 00 January 00:00 AM" previously — CSS-invisible but still
    // present in the DOM, which surfaced in text scrapers, screen-reader
    // buffers on some UAs, and copy-paste of the dashboard header).
    return (
      <div className="text-right flex-shrink-0 pl-4" aria-hidden>
        <p className="text-[0.8125rem] font-medium text-stone-700 tabular-nums invisible">
          {"\u00A0".repeat(17)}
        </p>
        <p className="text-[0.8125rem] text-stone-400 tabular-nums mt-0.5 invisible">
          {"\u00A0".repeat(8)}
        </p>
      </div>
    );
  }

  return (
    <div className="text-right flex-shrink-0 pl-4">
      <p className="text-[0.8125rem] font-medium text-stone-700 tabular-nums">
        {now.toLocaleDateString("en-AU", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
      <p className="text-[0.8125rem] text-stone-400 tabular-nums mt-0.5">
        {now.toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}
      </p>
    </div>
  );
}
