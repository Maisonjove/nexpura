import Link from "next/link";

export default function TrackingNotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-stone-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-stone-900 mb-2">
            Order Not Found
          </h1>
          <p className="text-stone-600 text-sm mb-8">
            We couldn&apos;t find an order with that tracking ID. Please check
            the ID and try again, or contact your jeweller for assistance.
          </p>

          <div className="space-y-3">
            <Link
              href="/track"
              className="block w-full py-3 px-4 bg-stone-900 text-white font-medium rounded-lg hover:bg-stone-800 transition-colors"
            >
              Try Another Tracking ID
            </Link>
            <a
              href="https://nexpura.com"
              className="block w-full py-3 px-4 border border-stone-200 text-stone-900 font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              Visit Nexpura
            </a>
          </div>
        </div>

        <p className="mt-8 text-xs text-stone-400">
          Powered by{" "}
          <span className="font-semibold text-stone-900">Nexpura</span>
        </p>
      </div>
    </div>
  );
}
