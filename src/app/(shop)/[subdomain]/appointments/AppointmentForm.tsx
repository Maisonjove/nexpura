"use client";

import { useState } from "react";

interface Props {
  subdomain: string;
  tenantId: string;
  primaryColor: string;
}

const APPOINTMENT_TYPES = [
  "Consultation",
  "Repair Drop-off",
  "Bespoke Discussion",
  "Valuation",
];

const TIME_SLOTS = ["Morning (9am–12pm)", "Afternoon (12pm–5pm)", "Evening (5pm–7pm)"];

export default function AppointmentForm({ subdomain, tenantId, primaryColor }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    appointment_type: "",
    preferred_date: "",
    preferred_time: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/shop/${subdomain}/appointment`, {
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
        <h2 className="text-xl font-bold text-stone-900 mb-2">Appointment Requested!</h2>
        <p className="text-stone-600">
          We'll confirm your appointment via email within 24 hours.
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
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Appointment Type *</label>
          <select
            required
            value={form.appointment_type}
            onChange={(e) => setForm((p) => ({ ...p, appointment_type: e.target.value }))}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <option value="">Select type…</option>
            {APPOINTMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Preferred Date *</label>
          <input
            required
            type="date"
            value={form.preferred_date}
            onChange={(e) => setForm((p) => ({ ...p, preferred_date: e.target.value }))}
            min={new Date().toISOString().split("T")[0]}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Preferred Time *</label>
          <select
            required
            value={form.preferred_time}
            onChange={(e) => setForm((p) => ({ ...p, preferred_time: e.target.value }))}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <option value="">Select time slot…</option>
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Notes (optional)</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Any additional information we should know…"
          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-400"
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
        {loading ? "Submitting…" : "Request Appointment"}
      </button>
    </form>
  );
}
