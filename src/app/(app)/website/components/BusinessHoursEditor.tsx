"use client";

import type { BusinessHours, BusinessHourEntry } from "../types";

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

const DEFAULT_HOURS: BusinessHourEntry = { open: "09:00", close: "17:00", closed: false };
const DEFAULT_WEEKEND: BusinessHourEntry = { open: "10:00", close: "15:00", closed: false };

export function getDefaultBusinessHours(): BusinessHours {
  return {
    monday: { ...DEFAULT_HOURS },
    tuesday: { ...DEFAULT_HOURS },
    wednesday: { ...DEFAULT_HOURS },
    thursday: { ...DEFAULT_HOURS },
    friday: { ...DEFAULT_HOURS },
    saturday: { ...DEFAULT_WEEKEND },
    sunday: { open: "10:00", close: "15:00", closed: true },
  };
}

interface BusinessHoursEditorProps {
  value: BusinessHours | null | undefined;
  onChange: (hours: BusinessHours) => void;
}

export default function BusinessHoursEditor({ value, onChange }: BusinessHoursEditorProps) {
  const hours: BusinessHours = value ?? getDefaultBusinessHours();

  function updateDay(day: keyof BusinessHours, field: keyof BusinessHourEntry, newValue: string | boolean) {
    onChange({
      ...hours,
      [day]: {
        ...hours[day],
        [field]: newValue,
      },
    });
  }

  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const dayHours = hours[key] ?? DEFAULT_HOURS;
        return (
          <div key={key} className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0">
            <div className="w-28 text-sm font-medium text-stone-700">{label}</div>
            <button
              onClick={() => updateDay(key, "closed", !dayHours.closed)}
              className={`relative inline-flex w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                !dayHours.closed ? "bg-amber-700" : "bg-stone-200"
              }`}
              aria-label={`Toggle ${label}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  !dayHours.closed ? "translate-x-4" : ""
                }`}
              />
            </button>
            {!dayHours.closed ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={dayHours.open}
                  onChange={(e) => updateDay(key, "open", e.target.value)}
                  className="px-2 py-1 border border-stone-200 rounded text-sm text-stone-700"
                />
                <span className="text-stone-400 text-sm">–</span>
                <input
                  type="time"
                  value={dayHours.close}
                  onChange={(e) => updateDay(key, "close", e.target.value)}
                  className="px-2 py-1 border border-stone-200 rounded text-sm text-stone-700"
                />
              </div>
            ) : (
              <span className="text-sm text-stone-400 italic">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
