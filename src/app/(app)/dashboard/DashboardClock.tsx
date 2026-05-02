"use client";

import { useEffect, useState } from "react";

/**
 * Date + live clock displayed in the dashboard page header.
 *
 * Brief (Section 3.1) wants:
 *  - Today's date in the serif type stack (e.g. "Saturday, 2 May 2026").
 *  - A small live clock below it in the sans stack.
 *
 * Server-renders to a layout-reserving placeholder so the header doesn't
 * shift when the client hydrates and the actual date/time stream in.
 *
 * Tick interval: 30s. The clock displays minutes only — anything finer
 * would just spin the CPU.
 */
export function DashboardClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!now) {
    // Reserve the same layout footprint the hydrated state will occupy.
    // Using non-breaking spaces (sized via .invisible) keeps the bounding
    // box identical without exposing placeholder text to assistive tech.
    return (
      <div className="text-right flex-shrink-0 pl-4" aria-hidden>
        <p className="font-serif text-[18px] font-normal text-nexpura-charcoal-700 invisible">
          {" ".repeat(20)}
        </p>
        <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-1 invisible">
          {" ".repeat(8)}
        </p>
      </div>
    );
  }

  return (
    <div className="text-right flex-shrink-0 pl-4">
      <p className="font-serif text-[18px] font-normal text-nexpura-charcoal-700 tabular-nums">
        {now.toLocaleDateString("en-AU", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-1 tabular-nums">
        {now.toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}
      </p>
    </div>
  );
}
