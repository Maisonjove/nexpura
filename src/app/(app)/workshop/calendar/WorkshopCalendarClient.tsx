"use client";

import { useState } from "react";
import Link from "next/link";

interface Repair {
  id: string;
  ticket_number: string | null;
  description: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  customers: { full_name: string | null } | null;
}

interface Bespoke {
  id: string;
  job_number: string | null;
  title: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  customers: { full_name: string | null } | null;
}

interface Staff {
  id: string;
  full_name: string | null;
}

interface Props {
  repairs: Repair[];
  bespoke: Bespoke[];
  staff: Staff[];
  tenantId: string;
}

type CalEvent = {
  id: string;
  type: "repair" | "bespoke";
  label: string;
  customer: string;
  date: string;
  status: string;
  assigned_to: string | null;
  href: string;
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkshopCalendarClient({ repairs, bespoke, staff }: Props) {
  const today = new Date();
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [staffFilter, setStaffFilter] = useState<string>("all");

  // Build events
  const allEvents: CalEvent[] = [
    ...repairs.map((r) => ({
      id: r.id,
      type: "repair" as const,
      label: r.ticket_number ? `Repair #${r.ticket_number}` : (r.description?.slice(0, 30) ?? "Repair"),
      customer: r.customers?.full_name ?? "—",
      date: r.due_date!,
      status: r.status,
      assigned_to: r.assigned_to,
      href: `/repairs/${r.id}`,
    })),
    ...bespoke.map((b) => ({
      id: b.id,
      type: "bespoke" as const,
      label: b.job_number ? `Job #${b.job_number}` : (b.title?.slice(0, 30) ?? "Bespoke"),
      customer: b.customers?.full_name ?? "—",
      date: b.due_date!,
      status: b.status,
      assigned_to: b.assigned_to,
      href: `/bespoke/${b.id}`,
    })),
  ];

  const filteredEvents = staffFilter === "all" ? allEvents : allEvents.filter((e) => e.assigned_to === staffFilter);

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  function eventsForDay(day: number): CalEvent[] {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filteredEvents.filter((e) => e.date.startsWith(dateStr));
  }

  // Week view
  function getWeekDays() {
    const startOfWeek = new Date(today);
    const d = today.getDay();
    startOfWeek.setDate(today.getDate() - d);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(startOfWeek);
      dt.setDate(startOfWeek.getDate() + i);
      return dt;
    });
  }

  const weekDays = getWeekDays();

  function eventsForDate(date: Date): CalEvent[] {
    const dateStr = date.toISOString().split("T")[0];
    return filteredEvents.filter((e) => e.date.startsWith(dateStr));
  }

  function eventColor(type: "repair" | "bespoke") {
    return type === "repair" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200";
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Workshop Calendar</h1>
          <p className="text-sm text-stone-500 mt-0.5">Repairs and bespoke jobs by due date</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/settings/task-templates" className="text-sm text-stone-500 hover:text-stone-900 border border-stone-200 px-3 py-1.5 rounded-lg">
            Task Templates
          </Link>
          <div className="flex rounded-lg border border-stone-200 overflow-hidden">
            <button onClick={() => setViewMode("month")} className={`px-3 py-1.5 text-sm font-medium ${viewMode === "month" ? "bg-amber-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>Month</button>
            <button onClick={() => setViewMode("week")} className={`px-3 py-1.5 text-sm font-medium ${viewMode === "week" ? "bg-amber-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>Week</button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Filter by Staff</h3>
            <div className="space-y-1">
              <button
                onClick={() => setStaffFilter("all")}
                className={`w-full text-left px-2 py-1.5 text-sm rounded-lg ${staffFilter === "all" ? "bg-amber-700/10 text-amber-700 font-medium" : "text-stone-600 hover:bg-stone-50"}`}
              >
                All Staff
              </button>
              {staff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStaffFilter(s.id)}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-lg truncate ${staffFilter === s.id ? "bg-amber-700/10 text-amber-700 font-medium" : "text-stone-600 hover:bg-stone-50"}`}
                >
                  {s.full_name ?? "Staff"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Legend</h3>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-amber-400" />
              <span className="text-xs text-stone-600">Repair</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-400" />
              <span className="text-xs text-stone-600">Bespoke</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 bg-white rounded-xl border border-stone-200 overflow-hidden">
          {viewMode === "month" ? (
            <>
              {/* Month nav */}
              <div className="flex items-center justify-between p-4 border-b border-stone-100">
                <button onClick={prevMonth} className="p-2 hover:bg-stone-50 rounded-lg">
                  <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-base font-semibold text-stone-900">{MONTH_NAMES[currentMonth]} {currentYear}</h2>
                <button onClick={nextMonth} className="p-2 hover:bg-stone-50 rounded-lg">
                  <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-stone-100">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[100px] p-1 border-b border-r border-stone-100 bg-stone-50/50" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dayEvents = eventsForDay(day);
                  const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
                  return (
                    <div key={day} className={`min-h-[100px] p-1 border-b border-r border-stone-100 ${isToday ? "bg-amber-700/5" : ""}`}>
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-amber-700 text-white" : "text-stone-500"}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <Link
                            key={ev.id}
                            href={ev.href}
                            className={`block text-xs px-1.5 py-0.5 rounded border truncate ${eventColor(ev.type)}`}
                          >
                            {ev.label}
                          </Link>
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-xs text-stone-400 pl-1">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Week view */
            <>
              <div className="p-4 border-b border-stone-100">
                <h2 className="text-base font-semibold text-stone-900">
                  Week of {weekDays[0].toLocaleDateString("en-AU", { day: "numeric", month: "long" })}
                </h2>
              </div>
              <div className="grid grid-cols-7 divide-x divide-stone-100">
                {weekDays.map((date, i) => {
                  const dayEvs = eventsForDate(date);
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <div key={i} className="min-h-[400px] p-2">
                      <div className={`text-center mb-2 pb-2 border-b border-stone-100`}>
                        <div className="text-xs text-stone-500">{DAY_NAMES[i]}</div>
                        <div className={`text-sm font-semibold w-7 h-7 rounded-full mx-auto flex items-center justify-center ${isToday ? "bg-amber-700 text-white" : "text-stone-900"}`}>
                          {date.getDate()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {dayEvs.map((ev) => (
                          <Link
                            key={ev.id}
                            href={ev.href}
                            className={`block text-xs px-2 py-1 rounded border ${eventColor(ev.type)}`}
                          >
                            <div className="font-medium truncate">{ev.label}</div>
                            <div className="truncate opacity-75">{ev.customer}</div>
                          </Link>
                        ))}
                        {dayEvs.length === 0 && (
                          <p className="text-xs text-stone-300 text-center pt-4">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
