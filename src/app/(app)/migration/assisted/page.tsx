'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, HeartHandshake, CheckCircle } from 'lucide-react';
import { MIGRATION_SOURCES } from '@/lib/migration/adapters';

export default function AssistedMigrationPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    source_platform: '',
    estimated_records: '',
    notes: '',
    contact_email: '',
    contact_phone: '',
    timeline: 'within_month',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/migration/assisted-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSubmitted(true);
    } catch {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-amber-700" />
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 mb-3">Request Received!</h1>
          <p className="text-stone-600 text-sm leading-relaxed max-w-sm mx-auto">
            Our migration team will be in touch within <strong>1 business day</strong> to discuss your data transfer and arrange a time that works for you.
          </p>
          <div className="mt-8">
            <Link
              href="/migration"
              className="inline-flex items-center gap-2 bg-amber-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Back to Migration Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/migration" className="text-stone-400 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Request Assisted Migration</h1>
          <p className="text-stone-500 text-sm">Let our specialists handle your migration end-to-end</p>
        </div>
      </div>

      {/* What you get */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
        <HeartHandshake className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-900 text-sm mb-2">What&apos;s included</h3>
          <ul className="text-xs text-amber-800 space-y-1">
            <li>✓ Dedicated migration specialist assigned to your account</li>
            <li>✓ We request and process your data exports for you</li>
            <li>✓ Full QA review of all imported data</li>
            <li>✓ Post-migration support for 30 days</li>
            <li>✓ Go-live guidance and staff training support</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-5 shadow-sm">
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1.5">Current System</label>
          <select
            name="source_platform"
            value={form.source_platform}
            onChange={handleChange}
            required
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Select your current platform...</option>
            {MIGRATION_SOURCES.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1.5">Approximate Record Count</label>
          <select
            name="estimated_records"
            value={form.estimated_records}
            onChange={handleChange}
            required
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">How much data do you have?</option>
            <option value="under_500">Under 500 records</option>
            <option value="500_to_2000">500–2,000 records</option>
            <option value="2000_to_10000">2,000–10,000 records</option>
            <option value="over_10000">10,000+ records</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1.5">Timeline</label>
          <select
            name="timeline"
            value={form.timeline}
            onChange={handleChange}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="urgent">Urgent — within 1 week</option>
            <option value="within_month">Within the month</option>
            <option value="flexible">Flexible timing</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1.5">Contact Email</label>
          <input
            type="email"
            name="contact_email"
            value={form.contact_email}
            onChange={handleChange}
            required
            placeholder="you@example.com"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1.5">Contact Phone (optional)</label>
          <input
            type="tel"
            name="contact_phone"
            value={form.contact_phone}
            onChange={handleChange}
            placeholder="+1 555 000 0000"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1.5">Additional Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any special requirements, data complexity, or context..."
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-700 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Migration Request'}
        </button>

        <p className="text-xs text-stone-500 text-center">
          We&apos;ll be in touch within 1 business day. No commitment required.
        </p>
      </form>
    </div>
  );
}
