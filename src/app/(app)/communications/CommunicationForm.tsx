"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendCommunication } from "./actions";

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";

const selectCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-900 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

export default function CommunicationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [type, setType] = useState("email");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await sendCommunication(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/communications"), 1500);
      }
    });
  }

  if (success) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center shadow-sm">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-stone-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-lg font-semibold text-stone-900">Message sent!</p>
        <p className="text-sm text-stone-500 mt-1">Redirecting…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Message Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="type">Type</FieldLabel>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={selectCls}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="note">Internal Note</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="customer_name">Customer Name</FieldLabel>
            <input
              id="customer_name"
              name="customer_name"
              type="text"
              placeholder="e.g. Sarah Johnson"
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel htmlFor="customer_email">Customer Email</FieldLabel>
            <input
              id="customer_email"
              name="customer_email"
              type="email"
              placeholder="sarah@example.com"
              className={inputCls}
            />
          </div>
        </div>

        {type !== "note" && (
          <div>
            <FieldLabel htmlFor="subject">Subject</FieldLabel>
            <input
              id="subject"
              name="subject"
              type="text"
              placeholder="e.g. Your repair is ready"
              className={inputCls}
            />
          </div>
        )}

        <div>
          <FieldLabel htmlFor="body" required>
            {type === "note" ? "Note" : "Message"}
          </FieldLabel>
          <textarea
            id="body"
            name="body"
            required
            rows={6}
            placeholder={
              type === "note"
                ? "Internal note about this customer or interaction…"
                : "Write your message here…"
            }
            className={`${inputCls} resize-none`}
          />
        </div>
      </Section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pb-6">
        <a
          href="/communications"
          className="px-5 py-2.5 text-sm font-medium text-stone-900 bg-white border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-all"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 text-sm font-medium bg-nexpura-charcoal text-white rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Sending…" : type === "note" ? "Save Note" : "Send Message"}
        </button>
      </div>
    </form>
  );
}
