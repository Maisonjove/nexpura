"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  scheduleDemoRequest,
  completeDemoRequest,
  declineDemoRequest,
} from "../actions";

export interface DemoRequestFull {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  business_name: string | null;
  phone: string | null;
  country: string;
  message: string | null;
  current_pos: string | null;
  num_stores: string | null;
  pain_point: string | null;
  preferred_time: string | null;
  plan: string | null;
  status: "new" | "scheduled" | "completed" | "declined";
  zoom_link: string | null;
  scheduled_at: string | null;
  decline_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_email: string | null;
}

const STATUS_BADGE: Record<DemoRequestFull["status"], string> = {
  new: "bg-amber-50 text-amber-700",
  scheduled: "bg-emerald-50 text-emerald-700",
  completed: "bg-stone-100 text-stone-700",
  declined: "bg-red-50 text-red-700",
};

function formatDateTimeSydney(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Default the scheduler input to "tomorrow at 10:00 Sydney" so the
// admin doesn't have to clear/refill a stale value. The datetime-local
// input takes a local-time string with no zone — we build it in
// Sydney time intentionally.
function defaultScheduledLocalString(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  });
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  const datePart = fmt.format(tomorrow);
  return `${datePart}T10:00`;
}

// datetime-local gives "YYYY-MM-DDTHH:mm" in the user's local zone
// (which on the admin's machine may not be Sydney). To lock the
// semantics to Sydney we treat the input as Sydney wall-time and
// convert to the corresponding UTC instant. Brittle DST math — but
// the admin is a single allowlisted account, the UI label is explicit
// "(Sydney)", and the .ics + email both render the human time we
// intend. If we ever go multi-admin we should swap this for a proper
// timezone-aware picker.
function sydneyLocalToUtcIso(localStr: string): string {
  // Parse as if it's UTC, then nudge by Sydney's offset at that
  // wall-clock instant.
  const naive = new Date(`${localStr}:00Z`);
  // Build a comparable wall-clock-in-Sydney for the same instant by
  // re-formatting through Intl, then diff.
  const sydneyParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(naive);
  const get = (t: string) => sydneyParts.find((p) => p.type === t)?.value ?? "00";
  const sydneyAsIfUtc = Date.UTC(
    +get("year"),
    +get("month") - 1,
    +get("day"),
    +get("hour"),
    +get("minute"),
    +get("second"),
  );
  const offsetMs = sydneyAsIfUtc - naive.getTime();
  return new Date(naive.getTime() - offsetMs).toISOString();
}

function actionLabel(a: string): string {
  switch (a) {
    case "demo_request.scheduled":
      return "Scheduled";
    case "demo_request.completed":
      return "Marked completed";
    case "demo_request.declined":
      return "Declined";
    default:
      return a;
  }
}

export default function DemoRequestDetailClient({
  request,
  audit,
}: {
  request: DemoRequestFull;
  audit: AuditEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionMode, setActionMode] = useState<"none" | "schedule" | "decline">("none");
  const [error, setError] = useState<string | null>(null);

  const [scheduleAt, setScheduleAt] = useState<string>(defaultScheduledLocalString());
  const [zoomLink, setZoomLink] = useState<string>("");
  const [declineReason, setDeclineReason] = useState<string>("");

  const fullName = [request.first_name, request.last_name].filter(Boolean).join(" ");

  const onSchedule = () => {
    setError(null);
    if (!zoomLink.trim()) {
      setError("Zoom URL is required.");
      return;
    }
    let utcIso: string;
    try {
      utcIso = sydneyLocalToUtcIso(scheduleAt);
    } catch {
      setError("Invalid date/time.");
      return;
    }
    startTransition(async () => {
      const r = await scheduleDemoRequest(request.id, utcIso, zoomLink.trim());
      if (!r.ok) {
        setError(r.error);
      } else {
        setActionMode("none");
        router.refresh();
      }
    });
  };

  const onComplete = () => {
    setError(null);
    if (!confirm("Mark this demo as completed?")) return;
    startTransition(async () => {
      const r = await completeDemoRequest(request.id);
      if (!r.ok) {
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  };

  const onDecline = () => {
    setError(null);
    startTransition(async () => {
      const r = await declineDemoRequest(request.id, declineReason);
      if (!r.ok) {
        setError(r.error);
      } else {
        setActionMode("none");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{fullName || request.email}</h1>
          <p className="text-sm text-stone-500 mt-1">
            Submitted {formatDateTimeSydney(request.created_at)}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[request.status]}`}
        >
          {request.status}
        </span>
      </div>

      {/* Submission */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="px-6 py-4 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-stone-900">Submission</h2>
        </div>
        <div className="px-6 py-4 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Field label="Email" value={request.email} mono />
          <Field label="Phone" value={request.phone} />
          <Field label="Business" value={request.business_name} />
          <Field label="Country" value={request.country} />
          <Field label="Plan interest" value={request.plan} capitalize />
          <Field label="Number of stores" value={request.num_stores} />
          <Field label="Current POS" value={request.current_pos} />
          <Field label="Preferred time" value={request.preferred_time} />
          <div className="sm:col-span-2">
            <Field label="Pain point" value={request.pain_point} multiline />
          </div>
          <div className="sm:col-span-2">
            <Field label="Message" value={request.message} multiline />
          </div>
        </div>
      </div>

      {/* Schedule details (if scheduled/completed) */}
      {(request.status === "scheduled" || request.status === "completed") && request.scheduled_at && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-stone-900">Scheduled demo</h2>
          </div>
          <div className="px-6 py-4 space-y-2 text-sm">
            <p className="text-stone-700">
              <span className="text-stone-500">When:</span>{" "}
              <strong>{formatDateTimeSydney(request.scheduled_at)}</strong>
            </p>
            {request.zoom_link && (
              <p className="text-stone-700">
                <span className="text-stone-500">Zoom:</span>{" "}
                <a
                  href={request.zoom_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-900 underline hover:text-stone-600 break-all"
                >
                  {request.zoom_link}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Decline reason (if declined) */}
      {request.status === "declined" && request.decline_reason && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-stone-900">Decline reason</h2>
          </div>
          <div className="px-6 py-4 text-sm text-stone-700 whitespace-pre-wrap">
            {request.decline_reason}
          </div>
        </div>
      )}

      {/* Actions */}
      {(request.status === "new" || request.status === "scheduled") && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-stone-900">Actions</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {actionMode === "none" && (
              <div className="flex flex-wrap gap-2">
                {request.status === "new" && (
                  <button
                    onClick={() => setActionMode("schedule")}
                    disabled={pending}
                    className="px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
                  >
                    Schedule demo
                  </button>
                )}
                {request.status === "scheduled" && (
                  <button
                    onClick={onComplete}
                    disabled={pending}
                    className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                )}
                <button
                  onClick={() => setActionMode("decline")}
                  disabled={pending}
                  className="px-3 py-1.5 text-sm font-medium border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}

            {actionMode === "schedule" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Zoom URL <span className="text-stone-400">(zoom.us / zoom.com)</span>
                  </label>
                  <input
                    type="url"
                    value={zoomLink}
                    onChange={(e) => setZoomLink(e.target.value)}
                    placeholder="https://zoom.us/j/123456789"
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Date and time <span className="text-stone-400">(Sydney)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onSchedule}
                    disabled={pending}
                    className="px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
                  >
                    {pending ? "Sending…" : "Confirm + send invite"}
                  </button>
                  <button
                    onClick={() => {
                      setActionMode("none");
                      setError(null);
                    }}
                    disabled={pending}
                    className="px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {actionMode === "decline" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Reason <span className="text-stone-400">(optional, included in email)</span>
                  </label>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. We're focused on jewellery retailers in AU/UK/US/EU only at this stage."
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onDecline}
                    disabled={pending}
                    className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {pending ? "Declining…" : "Confirm decline"}
                  </button>
                  <button
                    onClick={() => {
                      setActionMode("none");
                      setError(null);
                    }}
                    disabled={pending}
                    className="px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit trail */}
      {audit.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-stone-900">Audit trail</h2>
          </div>
          <ul className="px-6 py-2 divide-y divide-stone-100">
            {audit.map((a, i) => (
              <li key={i} className="py-3 text-sm flex items-start justify-between gap-4">
                <div>
                  <p className="text-stone-900 font-medium">{actionLabel(a.action)}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    by {a.admin_email || "system"} · {formatDateTimeSydney(a.created_at)}
                  </p>
                  {a.metadata && a.action === "demo_request.scheduled" && a.metadata.scheduled_at ? (
                    <p className="text-xs text-stone-500 mt-0.5">
                      Demo time:{" "}
                      {formatDateTimeSydney(a.metadata.scheduled_at as string)}
                    </p>
                  ) : null}
                  {a.metadata && a.action === "demo_request.declined" && a.metadata.reason ? (
                    <p className="text-xs text-stone-500 mt-0.5">
                      Reason: {a.metadata.reason as string}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Forensics — collapsed at the bottom */}
      <details className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <summary className="px-6 py-4 text-xs text-stone-500 cursor-pointer hover:text-stone-900">
          Submission forensics
        </summary>
        <div className="px-6 pb-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
          <Field label="IP" value={request.ip_address} mono small />
          <Field label="User agent" value={request.user_agent} mono small />
          <Field label="Updated" value={formatDateTimeSydney(request.updated_at)} small />
        </div>
      </details>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  capitalize,
  multiline,
  small,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  capitalize?: boolean;
  multiline?: boolean;
  small?: boolean;
}) {
  const valueClass = [
    small ? "text-xs" : "text-sm",
    "text-stone-900",
    mono ? "font-mono" : "",
    capitalize ? "capitalize" : "",
    multiline ? "whitespace-pre-wrap" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`${valueClass} mt-0.5 break-words`}>{value || <span className="text-stone-400">—</span>}</p>
    </div>
  );
}
