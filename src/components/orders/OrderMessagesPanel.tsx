"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { postStaffReply, markOrderMessagesRead, type OrderMessage } from "@/lib/messaging";

interface Props {
  orderType: "repair" | "bespoke";
  orderId: string;
  initialMessages: OrderMessage[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function OrderMessagesPanel({ orderType, orderId, initialMessages }: Props) {
  const [messages, setMessages] = useState<OrderMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startTransition] = useTransition();

  const unreadCount = messages.filter(
    (m) => m.sender_type === "customer" && m.read_by_staff_at === null
  ).length;

  // Mark customer messages as read when this panel mounts (jeweller has
  // opened the order page). Fire-and-forget; render isn't blocked on it.
  useEffect(() => {
    if (unreadCount === 0) return;
    markOrderMessagesRead({ orderType, orderId }).then((res) => {
      if (!res.error) {
        // Reflect locally — no need to refetch the whole thread.
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_type === "customer" && m.read_by_staff_at === null
              ? { ...m, read_by_staff_at: new Date().toISOString() }
              : m
          )
        );
      }
    });
    // Only auto-mark on mount; subsequent customer messages (via revalidate)
    // will show the unread badge again until the jeweller re-opens or acts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSend = useCallback(() => {
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      // Optimistic append so the staff sees their reply land instantly.
      const optimistic: OrderMessage = {
        id: `pending-${Date.now()}`,
        tenant_id: "",
        order_type: orderType,
        order_id: orderId,
        sender_type: "staff",
        sender_user_id: null,
        sender_display_name: "You",
        body: trimmed,
        message_type: "reply",
        read_by_staff_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setBody("");

      const res = await postStaffReply({ orderType, orderId, body: trimmed });
      if (res.error) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(res.error);
        setBody(trimmed);
      }
    });
  }, [body, orderId, orderType]);

  return (
    <section className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-gradient-to-b from-white to-stone-50/50">
        <div className="flex items-center gap-2">
          <h3 className="text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-stone-500">
            Customer Conversation
          </h3>
          {unreadCount > 0 && (
            <span
              className="inline-flex items-center justify-center text-[0.625rem] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700"
              aria-label={`${unreadCount} unread customer message${unreadCount > 1 ? "s" : ""}`}
            >
              {unreadCount} new
            </span>
          )}
        </div>
        <span className="text-[0.6875rem] text-stone-400">
          {messages.length} {messages.length === 1 ? "message" : "messages"}
        </span>
      </header>

      <div className="max-h-[420px] overflow-y-auto px-5 py-4 space-y-3 bg-stone-50/40">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-stone-500">No messages yet.</p>
            <p className="text-xs text-stone-400 mt-1">
              The customer can send amendment requests or questions from their tracking page.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isStaff = m.sender_type === "staff";
            const displayName = isStaff ? (m.sender_display_name || "You") : "Customer";
            const isAmendment = m.message_type === "amendment_request";
            const isNew = m.sender_type === "customer" && m.read_by_staff_at === null;
            return (
              <div key={m.id} className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] flex flex-col ${isStaff ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[0.6875rem] font-semibold uppercase tracking-wide ${isStaff ? "text-amber-700" : "text-stone-600"}`}>
                      {displayName}
                    </span>
                    {isAmendment && (
                      <span className="text-[0.625rem] font-semibold tracking-wide uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Amendment
                      </span>
                    )}
                    {isNew && (
                      <span className="text-[0.625rem] font-semibold tracking-wide uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        New
                      </span>
                    )}
                    <span className="text-[0.6875rem] text-stone-400">
                      {formatTime(m.created_at)}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed ${
                      isStaff
                        ? "bg-amber-700 text-white rounded-br-md"
                        : "bg-white text-stone-900 border border-stone-200 rounded-bl-md"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="border-t border-stone-100 px-5 py-4 bg-white space-y-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply to the customer…"
          rows={2}
          maxLength={4000}
          disabled={sending}
          className="w-full px-3 py-2 text-sm text-stone-900 placeholder-stone-400 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none disabled:opacity-60"
        />
        {error && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Reply"}
          </button>
        </div>
      </form>
    </section>
  );
}
