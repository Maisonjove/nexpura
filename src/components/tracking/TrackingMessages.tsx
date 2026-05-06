"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { postCustomerMessage, type OrderMessage } from "@/lib/messaging";

interface Props {
  trackingId: string;
  initialMessages: OrderMessage[];
  orderType: "repair" | "bespoke";
  /** Business display name, used in staff-reply bubble attribution fallback. */
  businessName: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function TrackingMessages({ trackingId, initialMessages, orderType, businessName }: Props) {
  const [messages, setMessages] = useState<OrderMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [isAmendment, setIsAmendment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, startTransition] = useTransition();

  const onSend = useCallback(() => {
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      // Optimistic append so the customer sees their message land immediately.
      const optimistic: OrderMessage = {
        id: `pending-${Date.now()}`,
        tenant_id: "",
        order_type: orderType,
        order_id: "",
        sender_type: "customer",
        sender_user_id: null,
        sender_display_name: null,
        body: trimmed,
        message_type: isAmendment ? "amendment_request" : "general",
        read_by_staff_at: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setBody("");
      setIsAmendment(false);

      const res = await postCustomerMessage({
        trackingId,
        body: trimmed,
        messageType: optimistic.message_type as "general" | "amendment_request",
      });
      if (res.error) {
        // Roll back the optimistic message and surface the error to the user.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(res.error);
        setBody(trimmed);
        setIsAmendment(optimistic.message_type === "amendment_request");
      }
    });
  }, [body, isAmendment, trackingId, orderType]);

  const empty = messages.length === 0;
  const label = orderType === "repair" ? "repair" : "bespoke job";

  const exampleRequests = useMemo(
    () => [
      "I need this by a different date",
      "Can the band be slightly thinner?",
      "Any update on progress?",
      "I'd like to change the stone if possible",
    ],
    []
  );

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <header className="px-5 py-5 sm:px-8 sm:py-6 border-b border-stone-200">
        <h2 className="font-serif text-lg text-stone-900 tracking-tight">
          Request an update or amendment
        </h2>
        <p className="text-xs text-stone-500 mt-1.5 font-sans leading-relaxed">
          Message {businessName} directly about this {label}. They&apos;ll see it in their workflow and reply here.
        </p>
      </header>

      <div className="max-h-[480px] overflow-y-auto px-5 py-5 sm:px-8 space-y-4 bg-[#F6F3EE]/40">
        {empty ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 mb-4">
              <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-sm text-stone-700 font-medium font-sans">No messages yet</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto font-sans leading-relaxed">
              Send an amendment request, ask a question, or request an update. Examples:
            </p>
            <ul className="mt-3 space-y-1 text-xs text-stone-400 font-sans">
              {exampleRequests.map((ex) => (
                <li key={ex} className="italic">&ldquo;{ex}&rdquo;</li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((m) => {
            const isCustomer = m.sender_type === "customer";
            const displayName = isCustomer ? "You" : (m.sender_display_name || businessName);
            const isAmendment = m.message_type === "amendment_request";
            return (
              <div
                key={m.id}
                className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] sm:max-w-[75%] ${isCustomer ? "items-end" : "items-start"} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-wide font-sans">
                      {displayName}
                    </span>
                    {isAmendment && (
                      <span className="inline-block text-[0.625rem] font-semibold tracking-wide uppercase bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full border border-stone-200 font-sans">
                        Amendment
                      </span>
                    )}
                    <span className="text-[0.6875rem] text-stone-400 font-sans">{formatTime(m.created_at)}</span>
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed font-sans ${
                      isCustomer
                        ? "bg-nexpura-bronze text-white rounded-br-md"
                        : "bg-white text-stone-900 border border-stone-200 rounded-bl-md shadow-sm"
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
        className="border-t border-stone-200 px-5 py-5 sm:px-8 sm:py-6 bg-white space-y-4"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            isAmendment
              ? "Describe the amendment you'd like…"
              : "Send a question, update request, or amendment…"
          }
          rows={3}
          maxLength={4000}
          disabled={sending}
          className="w-full px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-nexpura-bronze resize-none disabled:opacity-60 font-sans transition-all duration-200"
        />
        {error && (
          <p
            role="alert"
            className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg font-sans"
          >
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2.5 text-xs text-stone-500 cursor-pointer select-none font-sans">
            <input
              type="checkbox"
              checked={isAmendment}
              onChange={(e) => setIsAmendment(e.target.checked)}
              disabled={sending}
              className="w-3.5 h-3.5 rounded border-stone-300 text-nexpura-bronze focus:ring-nexpura-bronze/20 accent-nexpura-bronze"
            />
            This is an amendment request
          </label>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-nexpura-bronze text-white text-sm font-medium rounded-md hover:bg-nexpura-bronze-hover transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-sans cursor-pointer"
          >
            {sending ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" />
                </svg>
                Sending…
              </>
            ) : (
              "Send request"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
