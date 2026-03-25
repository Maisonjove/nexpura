"use client";

import type { JobEvent } from "./types";

interface ActivityTimelineProps {
  events: JobEvent[];
}

function formatEventDate(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ActivityTimeline({ events }: ActivityTimelineProps) {
  const sortedEvents = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Activity</h2>
      {events.length === 0 ? (
        <p className="text-sm text-stone-400">No activity yet</p>
      ) : (
        <div className="relative pl-5">
          <div className="absolute left-1.5 top-2 bottom-2 w-px bg-stone-100" />
          <div className="space-y-4">
            {sortedEvents.map(ev => (
              <div key={ev.id} className="relative flex gap-3">
                <div className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full bg-stone-200 border-2 border-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-700 leading-snug">{ev.description}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{formatEventDate(ev.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
