import Link from "next/link";

export const metadata = { title: "Bulk SMS — Nexpura" };

/**
 * Bulk SMS landing page. SMS marketing is currently routed through the
 * WhatsApp campaigns surface (richer media, lower per-message cost,
 * higher open rates for AU jewellery customers). Pre-fix this page
 * silently `redirect()`d to /marketing/whatsapp-campaigns which
 * confused users who linked into /marketing/bulk-sms expecting an SMS
 * builder. Now we render an explicit notice with a link, so the user
 * knows where the feature actually lives.
 */
export default function BulkSMSPage() {
  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto text-2xl">
        💬
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Bulk SMS has moved</h1>
        <p className="text-stone-500 mt-2 text-sm leading-relaxed">
          SMS marketing now runs through the WhatsApp campaigns surface — richer
          media, better delivery rates, and the same recipient picker. Plain SMS
          fallback fires automatically when the recipient isn&apos;t reachable on
          WhatsApp.
        </p>
      </div>
      <Link
        href="/marketing/whatsapp-campaigns"
        className="inline-flex items-center gap-2 px-6 py-3 bg-nexpura-charcoal text-white rounded-xl font-medium text-sm hover:bg-nexpura-charcoal-700 transition-colors"
      >
        Open WhatsApp Campaigns →
      </Link>
    </div>
  );
}
