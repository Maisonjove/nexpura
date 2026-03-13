"use client";

import { useState } from "react";

interface Props {
  subdomain: string;
  tenantId: string;
  itemName: string;
  primaryColor: string;
}

export default function ItemEnquiryForm({ subdomain, tenantId, itemName, primaryColor }: Props) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/shop/${subdomain}/enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          message: form.message || `Enquiry about: ${itemName}`,
          item_name: itemName,
        }),
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
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-medium text-green-800">Enquiry sent!</p>
        <p className="text-sm text-green-600 mt-1">We&apos;ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-semibold text-stone-900">Enquire About This Piece</h3>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Your name *"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
        />
        <input
          type="email"
          placeholder="Email address *"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
        />
      </div>
      <input
        type="tel"
        placeholder="Phone (optional)"
        value={form.phone}
        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
      />
      <textarea
        placeholder={`I'm interested in the ${itemName}…`}
        value={form.message}
        onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
        rows={3}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 resize-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? "Sending…" : "Send Enquiry"}
      </button>
    </form>
  );
}
