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
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Activity</h2>
      <div className="space-y-2">
        {sortedEvents.map(ev => (
          <div key={ev.id} className="flex items-start gap-2 text-sm">
            <span className="text-stone-400 text-xs whitespace-nowrap mt-0.5">{formatEventDate(ev.created_at)}</span>
            <span className="text-stone-600">{ev.description}</span>
          </div>
        ))}
        {events.length === 0 && <p className="text-sm text-stone-400">No activity yet</p>}
      </div>
    </div>
  );
}
