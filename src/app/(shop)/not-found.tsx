import Link from "next/link";

/**
 * Storefront-scoped 404. Distinct from the global `/not-found.tsx` in two
 * ways:
 *   1. It scopes the not-found boundary to the (shop) route group, so a
 *      `notFound()` thrown from any storefront page renders this layout
 *      with HTTP 404 (P3 Probe 10 — pre-fix the global not-found rendered
 *      with HTTP 200 because no segment-level boundary existed in the
 *      shop group, and `notFound()` inside Suspense fell back to the
 *      cacheComponents soft-200 path).
 *   2. The body is intentionally generic — no tenant info, no
 *      "Powered by Nexpura" platform branding — so a soft-deleted or
 *      never-existed tenant can't be inferred from this page.
 */
export default function ShopNotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-xs tracking-[0.18em] uppercase text-stone-400 font-medium mb-3">
          404
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold text-stone-900 mb-4">
          Page not found
        </h1>
        <p className="text-stone-500 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or is no longer
          available.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
        >
          Go home
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
