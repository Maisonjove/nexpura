"use client";

import { useState, useMemo, useTransition, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { resendEmailLog, markNotificationRead, markAllNotificationsRead } from "./actions";
import {
  ArrowPathIcon,
  ArchiveBoxIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  CheckCircleIcon,
  ChatBubbleLeftEllipsisIcon,
  ShieldCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BellIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
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

type HeroIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const ENTITY_HREFS: Record<string, string> = {
  invoice: "/invoices/",
  repair: "/repairs/",
  bespoke: "/bespoke/",
  passport: "/passports/",
  customer: "/customers/",
};

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "sent" || s === "delivered") return "nx-badge-success";
  if (s === "failed" || s === "bounced") return "nx-badge-danger";
  if (s === "draft" || s === "queued" || s === "pending") return "nx-badge-warning";
  return "nx-badge-neutral";
}

function channelIconForType(type: string): HeroIcon {
  const t = type.toLowerCase();
  if (t.includes("sms") || t.includes("phone")) return DevicePhoneMobileIcon;
  if (t.includes("whatsapp") || t.includes("chat")) return ChatBubbleLeftRightIcon;
  return EnvelopeIcon;
}

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

const NOTIF_TYPE_ICONS: Record<string, HeroIcon> = {
  low_stock: ArchiveBoxIcon,
  repair_status: WrenchScrewdriverIcon,
  bespoke_status: SparklesIcon,
  invoice_paid: CheckCircleIcon,
  new_enquiry: ChatBubbleLeftEllipsisIcon,
  passport_viewed: ShieldCheckIcon,
  trial_ending: ClockIcon,
  payment_failed: ExclamationTriangleIcon,
  system: BellIcon,
};

const TABS: { id: TabId; label: string }[] = [
  { id: "emails", label: "Sent Emails" },
  { id: "manual", label: "Manual Messages" },
  { id: "notifications", label: "Notifications" },
];

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

  const hasFilters = Boolean(search || dateFrom || dateTo);

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Customers
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Communications
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Review every email, manual message, and notification sent from your store.
            </p>
          </div>
          <Link
            href="/communications/new"
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Message
          </Link>
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count =
              tab.id === "emails"
                ? emailLogs.length
                : tab.id === "manual"
                ? comms.length
                : notifications.length;
            const showUnread = tab.id === "notifications" && unreadCount > 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  router.replace(pathname + (tab.id !== "emails" ? "?tab=" + tab.id : ""))
                }
                className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 inline-flex items-center gap-2 ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`text-xs rounded-full px-1.5 ${
                      isActive
                        ? "bg-white/15 text-white"
                        : showUnread
                        ? "bg-nexpura-bronze/10 text-nexpura-bronze font-semibold"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {showUnread ? `${unreadCount} new` : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-wrap items-end gap-4 mb-8">
          <div className="relative flex-1 min-w-[220px]">
            <label className="block text-xs text-stone-500 font-medium mb-1.5">Search</label>
            <MagnifyingGlassIcon className="absolute left-3 top-[2.1rem] h-4 w-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              defaultValue={search}
              onChange={(e) => pushParams({ q: e.target.value })}
              placeholder="Recipient, subject, type…"
              className="pl-9 w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 font-medium mb-1.5">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => pushParams({ from: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 font-medium mb-1.5">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => pushParams({ to: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => pushParams({ q: null, from: null, to: null })}
              className="px-4 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors duration-200"
            >
              Clear
            </button>
          )}
          {dateFrom && dateTo && dateFrom > dateTo && (
            <p className="w-full text-xs text-red-600">
              End date is before start date — no rows match.
            </p>
          )}
        </div>

        {/* Sent Emails Tab */}
        {activeTab === "emails" && (
          <>
            {filteredEmailLogs.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
                <EnvelopeIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
                <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                  {emailLogs.length === 0 ? "No emails yet" : "No emails match your filters"}
                </h3>
                <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
                  {emailLogs.length === 0
                    ? "Transactional emails sent from your store will appear here."
                    : "Try clearing the search or adjusting your dates."}
                </p>
                {emailLogs.length === 0 ? (
                  <Link
                    href="/communications/new"
                    className="nx-btn-primary inline-flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Send a message
                  </Link>
                ) : (
                  hasFilters && (
                    <button
                      type="button"
                      onClick={() => pushParams({ q: null, from: null, to: null })}
                      className="nx-btn-primary inline-flex items-center gap-2"
                    >
                      Clear filters
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEmailLogs.map((log) => {
                  const ChannelIcon = channelIconForType(log.email_type);
                  return (
                    <div
                      key={log.id}
                      className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex items-start gap-5 min-w-0 flex-1">
                          <div className="shrink-0 mt-1">
                            <ChannelIcon
                              className="w-5 h-5 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300"
                              strokeWidth={1.5}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 flex-wrap mb-1.5">
                              <span className={statusBadgeClass(log.status)}>{log.status}</span>
                              <span className="text-xs text-stone-400 font-mono">
                                {log.email_type}
                              </span>
                              {log.reference_type && log.reference_id && (
                                <Link
                                  href={`${ENTITY_HREFS[log.reference_type] || "/"}${log.reference_id}`}
                                  className="text-xs text-nexpura-bronze hover:text-nexpura-bronze-hover capitalize inline-flex items-center gap-1 transition-colors duration-200"
                                >
                                  {log.reference_type}
                                  <ArrowRightIcon className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                            <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight truncate">
                              {log.recipient}
                            </h3>
                            <p className="text-sm text-stone-500 mt-1.5 leading-relaxed truncate">
                              {log.subject ?? "—"}
                            </p>
                            {log.bounce_reason && (
                              <p
                                className="text-xs text-red-600 mt-2 max-w-md truncate"
                                title={log.bounce_reason}
                              >
                                {log.bounce_reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <p className="text-xs text-stone-400 tabular-nums">
                            {formatDate(log.created_at)}
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Resend this email?")) return;
                              const res = await resendEmailLog(log.id);
                              if (res.error) toast.error(res.error);
                              else toast.success("Email resent successfully");
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-nexpura-bronze transition-colors duration-200"
                            title="Resend Email"
                          >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            Resend
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Manual Messages Tab */}
        {activeTab === "manual" && (
          <>
            {filteredComms.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
                <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                  {comms.length === 0 ? "No manual messages yet" : "No messages match your filters"}
                </h3>
                <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
                  {comms.length === 0
                    ? "Compose a message to a customer to start a conversation."
                    : "Try clearing the search or adjusting your dates."}
                </p>
                {comms.length === 0 ? (
                  <Link
                    href="/communications/new"
                    className="nx-btn-primary inline-flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    New message
                  </Link>
                ) : (
                  hasFilters && (
                    <button
                      type="button"
                      onClick={() => pushParams({ q: null, from: null, to: null })}
                      className="nx-btn-primary inline-flex items-center gap-2"
                    >
                      Clear filters
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredComms.map((comm) => {
                  const ChannelIcon = channelIconForType(comm.type);
                  return (
                    <Link
                      key={comm.id}
                      href={`/communications/${comm.id}`}
                      className="group block bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex items-start gap-5 min-w-0 flex-1">
                          <div className="shrink-0 mt-1">
                            <ChannelIcon
                              className="w-5 h-5 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300"
                              strokeWidth={1.5}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 flex-wrap mb-1.5">
                              <span className={statusBadgeClass(comm.status)}>{comm.status}</span>
                              <span className="text-xs text-stone-400 font-mono capitalize">
                                {comm.type}
                              </span>
                            </div>
                            <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight truncate">
                              {comm.customer_name ?? comm.customer_email ?? "Unknown recipient"}
                            </h3>
                            {comm.subject && (
                              <p className="text-sm text-stone-700 mt-1.5 truncate">
                                {comm.subject}
                              </p>
                            )}
                            {comm.customer_email && comm.customer_name && (
                              <p className="text-xs text-stone-400 mt-1 truncate">
                                {comm.customer_email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <p className="text-xs text-stone-400 tabular-nums">
                            {formatDate(comm.created_at)}
                          </p>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300">
                            View
                            <ArrowRightIcon className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <>
            {notifications.length > 0 && (
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-stone-500">
                  {unreadCount > 0
                    ? `${unreadCount} unread of ${notifications.length}`
                    : `All ${notifications.length} read`}
                </p>
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={unreadCount === 0}
                  className="text-xs font-semibold text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Mark all read
                </button>
              </div>
            )}
            {filteredNotifs.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
                <BellIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
                <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                  {notifications.length === 0
                    ? "No notifications yet"
                    : "No notifications match your filters"}
                </h3>
                <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
                  {notifications.length === 0
                    ? "Notifications appear here when triggered by platform events."
                    : "Try clearing the search or adjusting your dates."}
                </p>
                {notifications.length > 0 && hasFilters && (
                  <button
                    type="button"
                    onClick={() => pushParams({ q: null, from: null, to: null })}
                    className="nx-btn-primary inline-flex items-center gap-2"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNotifs.map((notif) => {
                  const NotifIcon = NOTIF_TYPE_ICONS[notif.type] ?? BellIcon;
                  return (
                    <div
                      key={notif.id}
                      className={`group bg-white border rounded-2xl p-6 transition-all duration-400 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 ${
                        notif.is_read ? "border-stone-200" : "border-nexpura-bronze/30 bg-nexpura-bronze/[0.03]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex items-start gap-5 min-w-0 flex-1">
                          <div className="shrink-0 mt-1">
                            <NotifIcon
                              className="w-5 h-5 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300"
                              strokeWidth={1.5}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 flex-wrap mb-1.5">
                              <span
                                className={
                                  notif.is_read ? "nx-badge-neutral" : "nx-badge-warning"
                                }
                              >
                                {notif.is_read ? "Read" : "Unread"}
                              </span>
                              <span className="text-xs text-stone-400 font-mono">
                                {notif.type}
                              </span>
                            </div>
                            <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                              {notif.title}
                            </h3>
                            {notif.body && (
                              <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                                {notif.body}
                              </p>
                            )}
                            <p className="text-xs text-stone-400 mt-2">
                              For {notif.users?.full_name || "All users"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <p className="text-xs text-stone-400 tabular-nums">
                            {formatDate(notif.created_at)}
                          </p>
                          <div className="flex items-center gap-4">
                            {!notif.is_read && (
                              <button
                                type="button"
                                onClick={() => handleMarkOne(notif.id)}
                                className="text-xs font-medium text-stone-500 hover:text-nexpura-bronze transition-colors duration-200"
                              >
                                Mark read
                              </button>
                            )}
                            {notif.link && (
                              <a
                                href={notif.link}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300"
                              >
                                View
                                <ArrowRightIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
