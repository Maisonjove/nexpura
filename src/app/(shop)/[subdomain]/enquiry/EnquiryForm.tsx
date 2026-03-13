"use client";

import { useState } from "react";

interface Props {
  subdomain: string;
  tenantId: string;
  defaultItem?: string;
  primaryColor: string;
  contactEmail?: string;
}

export default function EnquiryForm({ subdomain, defaultItem, primaryColor }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: defaultItem ? `I'm interested in: ${defaultItem}` : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/shop/${subdomain}/enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send enquiry");
      }

      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">✉️</div>
        <h3 className="text-xl font-semibold text-stone-900">Message Sent!</h3>
        <p className="text-stone-500 mt-2">
          Thank you for your enquiry. We&apos;ll be in touch within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
          Full Name *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
          placeholder="Jane Smith"
          className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 focus:border-stone-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
          Email Address *
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
          placeholder="jane@example.com"
          className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 focus:border-stone-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
          Phone
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          placeholder="+61 400 000 000"
          className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 focus:border-stone-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
          Message *
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
          required
          rows={5}
          placeholder="Tell us what you're looking for…"
          className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 focus:border-stone-400 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 text-sm"
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? "Sending…" : "Send Enquiry"}
      </button>

      <p className="text-xs text-stone-400 text-center">
        We&apos;ll respond within 24 hours.
      </p>
    </form>
  );
}
