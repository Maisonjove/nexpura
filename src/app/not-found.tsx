import Link from "next/link";

/**
 * Global 404. Restyled to the marketing token system per Kaitlyn brief
 * #2 Section 10H — ivory background, serif headline, charcoal pill
 * primary CTA, no amber/stone-* legacy palette. CTA points to /
 * (homepage) instead of /dashboard so an unauthenticated visitor who
 * hits a wrong URL doesn't get bounced into the auth wall.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-m-ivory flex items-center justify-center px-6">
      <div className="text-center max-w-[480px]">
        <div className="w-14 h-14 mx-auto mb-8 rounded-2xl bg-m-charcoal flex items-center justify-center">
          <span className="font-serif text-[22px] font-medium text-white tracking-[0.32em]">N</span>
        </div>

        <p className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-3">
          404
        </p>
        <h1 className="font-serif text-[36px] sm:text-[44px] font-normal leading-[1.12] text-m-charcoal mb-4">
          Page not found
        </h1>
        <p className="text-[16px] leading-[1.55] text-m-text-secondary mb-10">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full bg-m-charcoal text-white text-[15px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:bg-m-charcoal-soft hover:shadow-[0_6px_16px_rgba(0,0,0,0.18)] transition-all duration-200 [transition-timing-function:var(--m-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne focus-visible:ring-offset-2"
        >
          Back to home
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
