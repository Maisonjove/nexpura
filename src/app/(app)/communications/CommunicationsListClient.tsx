"use client";

import Link from "next/link";

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

interface Props {
  comms: Communication[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  email: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  sms: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  note: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

const STATUS_COLOURS: Record<string, string> = {
  sent: "bg-green-50 text-green-700",
  delivered: "bg-stone-100 text-[#8B7355]",
  failed: "bg-red-50 text-red-600",
  draft: "bg-stone-900/10 text-stone-500",
};

export default function CommunicationsListClient({ comms }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">Communications</h1>
        <Link
          href="/communications/new"
          className="inline-flex items-center gap-2 bg-[#8B7355] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#7A6347] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Message
        </Link>
      </div>

      {comms.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg font-semibold text-stone-900">No messages yet</h3>
          <p className="text-stone-500 mt-1 text-sm">Send your first message or note to a customer.</p>
          <Link
            href="/communications/new"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors"
          >
            Send first message
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm divide-y divide-platinum">
          {comms.map((comm) => (
            <div key={comm.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50/50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-stone-100 text-[#8B7355] flex items-center justify-center flex-shrink-0">
                {TYPE_ICONS[comm.type] || TYPE_ICONS.email}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 truncate">
                  {comm.subject || `(${comm.type})`}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {comm.customer_name || comm.customer_email || "No recipient"} ·{" "}
                  {new Date(comm.created_at).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs font-medium capitalize text-stone-500">{comm.type}</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    STATUS_COLOURS[comm.status] || "bg-stone-900/10 text-stone-500"
                  }`}
                >
                  {comm.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
