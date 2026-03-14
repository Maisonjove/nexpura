"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { resendEmailLog } from "./actions";
import { RefreshCw } from "lucide-react";

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
  recipient_email: string;
  recipient_name: string | null;
  template_type: string;
  subject: string | null;
  status: string;
  resend_message_id: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  sent_at: string;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
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
  delivered: "bg-stone-100 text-[#8B7355]",
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

const NOTIF_TYPE_ICONS: Record<string, string> = {
  low_stock: "📦",
  repair_status: "🔧",
  bespoke_status: "💎",
  invoice_paid: "✅",
  new_enquiry: "💬",
  passport_viewed: "🛡️",
  trial_ending: "⏰",
  payment_failed: "❌",
  system: "🔔",
};

export default function CommunicationsListClient({ comms, emailLogs, notifications }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("emails");

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

      {/* Tabs */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-200">
          {(["emails", "manual", "notifications"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-[#8B7355] text-[#8B7355]"
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
                <span className="ml-2 bg-stone-100 text-stone-600 text-xs rounded-full px-2 py-0.5">
                  {notifications.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sent Emails Tab */}
        {activeTab === "emails" && (
          <>
            {emailLogs.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-stone-400">No emails logged yet</div>
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
                    {emailLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-stone-900">{log.recipient_name ?? log.recipient_email}</p>
                          <p className="text-xs text-stone-400">{log.recipient_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-mono">
                            {log.template_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-600 max-w-48 truncate">{log.subject ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[log.status] || "bg-stone-100 text-stone-600"}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.linked_entity_type && log.linked_entity_id ? (
                            <Link
                              href={`${ENTITY_HREFS[log.linked_entity_type] || "/"}${log.linked_entity_id}`}
                              className="text-xs text-[#8B7355] hover:underline capitalize"
                            >
                              {log.linked_entity_type} ↗
                            </Link>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-400">{formatDate(log.sent_at || log.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (!confirm("Resend this email?")) return;
                              const res = await resendEmailLog(log.id);
                              if (res.error) alert(res.error);
                              else alert("Email resent successfully");
                            }}
                            className="p-1.5 text-stone-400 hover:text-[#8B7355] transition-colors"
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
            {comms.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-stone-400">No manual messages yet</div>
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
                    {comms.map((comm) => (
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
                          <Link href={`/communications/${comm.id}`} className="text-xs text-[#8B7355] hover:underline">
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
            {notifications.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-stone-400">
                <p>🔔 No notifications yet</p>
                <p className="mt-2 text-xs">Notifications appear here when triggered by platform events</p>
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
                    {notifications.map((notif) => (
                      <tr key={notif.id} className={`hover:bg-stone-50 ${!notif.read ? "bg-[#8B7355]/5" : ""}`}>
                        <td className="px-5 py-3">
                          <span className="text-base">{NOTIF_TYPE_ICONS[notif.type] ?? "🔔"}</span>
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
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${notif.read ? "bg-stone-100 text-stone-400" : "bg-[#8B7355]/10 text-[#8B7355]"}`}>
                            {notif.read ? "Read" : "Unread"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-400">{formatDate(notif.created_at)}</td>
                        <td className="px-4 py-3">
                          {notif.link && (
                            <a href={notif.link} className="text-xs text-[#8B7355] hover:underline">
                              View →
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
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
