"use client";

import { useState } from "react";

interface Props {
  subdomain: string;
  tenantId: string;
  primaryColor: string;
}

export default function RepairEnquiryForm({ subdomain, tenantId, primaryColor }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    item_description: "",
    issue_description: "",
    preferred_date: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/shop/${subdomain}/repair-enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-stone-900 mb-2">Enquiry Received!</h2>
        <p className="text-stone-600">
          We'll review your repair request and get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-stone-50 rounded-2xl p-6 border border-stone-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Name *</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Preferred Drop-off Date</label>
          <input
            type="date"
            value={form.preferred_date}
            onChange={(e) => setForm((p) => ({ ...p, preferred_date: e.target.value }))}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Item Description *</label>
        <textarea
          required
          rows={3}
          value={form.item_description}
          onChange={(e) => setForm((p) => ({ ...p, item_description: e.target.value }))}
          placeholder="e.g. 18ct yellow gold diamond ring"
          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Issue Description *</label>
        <textarea
          required
          rows={3}
          value={form.issue_description}
          onChange={(e) => setForm((p) => ({ ...p, issue_description: e.target.value }))}
          placeholder="e.g. Prong is bent, stone is loose"
          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{ backgroundColor: primaryColor }}
        className="w-full py-4 text-white rounded-xl font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Submit Repair Enquiry"}
      </button>
    </form>
  );
}
