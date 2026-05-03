"use client";

import { useState, useMemo, useTransition, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { resendEmailLog, markNotificationRead, markAllNotificationsRead } from "./actions";
import {
  RefreshCw,
  Package,
  Wrench,
  Gem,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Bell,
  Search,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

export interface Communication {
  id: string;
  type: string;
  subject: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  sent_at: string;
  created_at: string;
}

export interface EmailLog {
  id: string;
  recipient: string;
  email_type: string;
  subject: string | null;
  status: string;
  resend_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  bounce_reason: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  users?: { full_name: string; email: string } | null;
}

interface Props {
  comms: Communication[];
  emailLogs: EmailLog[];
  notifications: NotificationLog[];
}

const STATUS_COLOURS: Record<string, string> = {
  sent: "bg-green-50 text-green-700",
  delivered: "bg-stone-100 text-amber-700",
  failed: "bg-red-50 text-red-600",
  draft: "bg-stone-900/10 text-stone-500",
};

const ENTITY_HREFS: Record<string, string> = {
  invoice: "/invoices/",
  repair: "/repairs/",
  bespoke: "/bespoke/",
  passport: "/passports/",
  customer: "/customers/",
};

function formatDate(dt: string) {
  return new Date(dt).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TabId = "emails" | "manual" | "notifications";

const NOTIF_TYPE_ICONS: Record<string, LucideIcon> = {
  low_stock: Package,
  repair_status: Wrench,
  bespoke_status: Gem,
  invoice_paid: CheckCircle2,
  new_enquiry: MessageCircle,
  passport_viewed: ShieldCheck,
  trial_ending: Clock,
  payment_failed: AlertTriangle,
  system: Bell,
};

function CommunicationsListClientInner({ comms, emailLogs, notifications: initialNotifs }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') || 'emails') as TabId;

  // Local copy of notifications so optimistic mark-read doesn't require a
  // full page round-trip.
  const [notifications, setNotifications] = useState(initialNotifs);
  const [, startTransition] = useTransition();

  // Filters (per-tab; preserved in URL so back-button restores them).
  const search = searchParams.get("q") ?? "";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function inDateRange(iso: string) {
    if (!dateFrom && !dateTo) return true;
    const d = iso.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }

  const filteredEmailLogs = useMemo(() => {
    const needle = search.toLowerCase();
    return emailLogs.filter((l) => {
      if (!inDateRange(l.created_at)) return false;
      if (!needle) return true;
      return (
        l.recipient.toLowerCase().includes(needle) ||
        (l.subject ?? "").toLowerCase().includes(needle) ||
        l.email_type.toLowerCase().includes(needle)
      );
    });
  }, [emailLogs, search, dateFrom, dateTo]);

  const filteredComms = useMemo(() => {
    const needle = search.toLowerCase();
    return comms.filter((c) => {
      if (!inDateRange(c.created_at)) return false;
      if (!needle) return true;
      return (
        (c.customer_name ?? "").toLowerCase().includes(needle) ||
        (c.customer_email ?? "").toLowerCase().includes(needle) ||
        (c.subject ?? "").toLowerCase().includes(needle)
      );
    });
  }, [comms, search, dateFrom, dateTo]);

  const filteredNotifs = useMemo(() => {
    const needle = search.toLowerCase();
    return notifications.filter((n) => {
      if (!inDateRange(n.created_at)) return false;
      if (!needle) return true;
      return (
        n.title.toLowerCase().includes(needle) ||
        (n.body ?? "").toLowerCase().includes(needle) ||
        n.type.toLowerCase().includes(needle)
      );
    });
  }, [notifications, search, dateFrom, dateTo]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleMarkOne(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    startTransition(async () => {
      const r = await markNotificationRead(id);
      if (r.error) {
        // Revert
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)));
        toast.error(r.error);
      }
    });
  }

  function handleMarkAll() {
    if (unreadCount === 0) return;
    const before = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    startTransition(async () => {
      const r = await markAllNotificationsRead();
      if (r.error) {
        setNotifications(before);
        toast.error(r.error);
      } else {
        toast.success(`Marked ${r.updated ?? unreadCount} as read`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl text-stone-900">Communications</h1>
        <Link
          href="/communications/new"
          className="px-4 py-2 bg-[#071A0D] text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
        >
          + New Message
        </Link>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-end gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <label className="block text-xs text-stone-500 font-medium mb-1">Search</label>
          <Search className="absolute left-2.5 top-7 h-4 w-4 text-stone-400" />
          <input
            type="text"
            defaultValue={search}
            onChange={(e) => pushParams({ q: e.target.value })}
            placeholder="Recipient, subject, type…"
            className="pl-9 h-9 w-full text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-700"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => pushParams({ from: e.target.value })}
            className="h-9 px-3 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-700"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => pushParams({ to: e.target.value })}
            className="h-9 px-3 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-700"
          />
        </div>
        {(search || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => pushParams({ q: null, from: null, to: null })}
            className="h-9 px-3 text-xs text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50"
          >
            Clear
          </button>
        )}
        {dateFrom && dateTo && dateFrom > dateTo && (
          <p className="w-full text-xs text-red-600">End date is before start date — no rows match.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-200">
          {(["emails", "manual", "notifications"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => router.replace(pathname + (tab !== 'emails' ? '?tab=' + tab : ''))}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-amber-600 text-amber-700"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {tab === "emails" ? "Sent Emails" : tab === "manual" ? "Manual Messages" : "Notifications"}
              {tab === "emails" && emailLogs.length > 0 && (
                <span className="ml-2 bg-stone-100 text-stone-600 text-xs rounded-full px-2 py-0.5">
                  {emailLogs.length}
                </span>
              )}
              {tab === "notifications" && notifications.length > 0 && (
                <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${
                  unreadCount > 0 ? "bg-amber-100 text-amber-700 font-semibold" : "bg-stone-100 text-stone-600"
                }`}>
                  {unreadCount > 0 ? `${unreadCount} unread` : notifications.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sent Emails Tab */}
        {activeTab === "emails" && (
          <>
            {filteredEmailLogs.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-stone-400">
                {emailLogs.length === 0 ? "No emails logged yet" : "No emails match your filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Recipient</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Template</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Subject</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Linked</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Sent</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredEmailLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-stone-900">{log.recipient}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-mono">
                            {log.email_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-600 max-w-48 truncate">{log.subject ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[log.status] || "bg-stone-100 text-stone-600"}`}>
                            {log.status}
                          </span>
                          {log.bounce_reason && (
                            <p className="text-[11px] text-red-600 mt-0.5 max-w-44 truncate" title={log.bounce_reason}>
                              {log.bounce_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {log.reference_type && log.reference_id ? (
                            <Link
                              href={`${ENTITY_HREFS[log.reference_type] || "/"}${log.reference_id}`}
                              className="text-xs text-amber-700 hover:underline capitalize"
                            >
                              {log.reference_type} ↗
                            </Link>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-400">{formatDate(log.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (!confirm("Resend this email?")) return;
                              const res = await resendEmailLog(log.id);
                              if (res.error) toast.error(res.error);
                              else toast.success("Email resent successfully");
                            }}
                            className="p-1.5 text-stone-400 hover:text-amber-700 transition-colors"
                            title="Resend Email"
                          >
                            <RefreshCw size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Manual Messages Tab */}
        {activeTab === "manual" && (
          <>
            {filteredComms.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-stone-400">
                {comms.length === 0 ? "No manual messages yet" : "No manual messages match your filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Subject</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredComms.map((comm) => (
                      <tr key={comm.id} className="hover:bg-stone-50">
                        <td className="px-5 py-3">
                          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full capitalize">{comm.type}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-900 max-w-48 truncate">{comm.subject ?? "—"}</td>
                        <td className="px-4 py-3">
                          {comm.customer_name && <p className="font-medium text-stone-900">{comm.customer_name}</p>}
                          {comm.customer_email && <p className="text-xs text-stone-400">{comm.customer_email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[comm.status] || "bg-stone-100 text-stone-600"}`}>
                            {comm.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-400">{formatDate(comm.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/communications/${comm.id}`} className="text-xs text-amber-700 hover:underline">
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <>
            {/* Mark-all-read action bar */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
                <p className="text-xs text-stone-500">
                  {unreadCount > 0
                    ? `${unreadCount} unread of ${notifications.length}`
                    : `All ${notifications.length} read`}
                </p>
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={unreadCount === 0}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Mark all read
                </button>
              </div>
            )}
            {filteredNotifs.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-stone-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-nexpura-taupe-400" strokeWidth={1.5} />
                <p>{notifications.length === 0 ? "No notifications yet" : "No notifications match your filters"}</p>
                {notifications.length === 0 && (
                  <p className="mt-2 text-xs">Notifications appear here when triggered by platform events</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Title</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Message</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Recipient</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Read</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredNotifs.map((notif) => {
                      const NotifIcon = NOTIF_TYPE_ICONS[notif.type] ?? Bell;
                      return (
                      <tr key={notif.id} className={`hover:bg-stone-50 ${!notif.is_read ? "bg-nexpura-bronze/5" : ""}`}>
                        <td className="px-5 py-3">
                          <NotifIcon className="w-4 h-4 text-nexpura-taupe-400" strokeWidth={1.5} />
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-900 max-w-48">
                          <p className="truncate">{notif.title}</p>
                          <span className="text-xs text-stone-400 font-mono">{notif.type}</span>
                        </td>
                        <td className="px-4 py-3 text-stone-500 max-w-56">
                          <p className="truncate text-xs">{notif.body || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {notif.users?.full_name || "All users"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${notif.is_read ? "bg-stone-100 text-stone-400" : "bg-amber-700/10 text-amber-700"}`}>
                            {notif.is_read ? "Read" : "Unread"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-400">{formatDate(notif.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            {!notif.is_read && (
                              <button
                                type="button"
                                onClick={() => handleMarkOne(notif.id)}
                                className="text-xs font-semibold text-amber-700 hover:underline"
                              >
                                Mark read
                              </button>
                            )}
                            {notif.link && (
                              <a href={notif.link} className="text-xs text-nexpura-bronze hover:underline">
                                View →
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export default function CommunicationsListClient(props: Parameters<typeof CommunicationsListClientInner>[0]) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <CommunicationsListClientInner {...props} />
    </Suspense>
  );
}
