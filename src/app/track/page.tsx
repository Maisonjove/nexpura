"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrackOrderPage() {
  const router = useRouter();
  const [trackingId, setTrackingId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = trackingId.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a tracking ID");
      return;
    }

    // Basic validation - tracking IDs should start with RPR- or BSP-
    if (!trimmed.startsWith("RPR-") && !trimmed.startsWith("BSP-")) {
      setError("Invalid tracking ID format. IDs start with RPR- or BSP-");
      return;
    }

    setIsSearching(true);
    router.push(`/track/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-lg mx-auto px-4 py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900">
            Track Your Order
          </h1>
          <p className="mt-2 text-stone-600 text-sm">
            Enter your tracking ID to see the status of your jewellery order
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        {/* Search Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="tracking"
                className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2"
              >
                Tracking ID
              </label>
              <input
                id="tracking"
                type="text"
                placeholder="e.g. RPR-A1B2C3D4"
                value={trackingId}
                onChange={(e) => {
                  setTrackingId(e.target.value.toUpperCase());
                  setError(null);
                }}
                className="w-full px-4 py-3.5 text-lg font-mono text-center border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all uppercase"
                autoComplete="off"
                autoCapitalize="characters"
              />
              {error && (
                <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full py-3.5 bg-stone-900 text-white font-semibold rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <svg
                    className="animate-spin w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Searching...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
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
                  Track Order
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-100">
            <p className="text-xs text-stone-500 text-center leading-relaxed">
              Your tracking ID was sent to you via email when your order was
              placed. If you can&apos;t find it, please contact your jeweller.
            </p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <span className="text-lg">🔧</span>
            </div>
            <h3 className="font-semibold text-stone-900 text-sm mb-1">
              Repairs
            </h3>
            <p className="text-xs text-stone-500">
              Track repairs with IDs starting with RPR-
            </p>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mb-3">
              <span className="text-lg">✨</span>
            </div>
            <h3 className="font-semibold text-stone-900 text-sm mb-1">
              Bespoke
            </h3>
            <p className="text-xs text-stone-500">
              Track custom orders with IDs starting with BSP-
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-12">
          <p className="text-xs text-stone-400">
            Powered by{" "}
            <a
              href="https://nexpura.com"
              className="font-semibold text-stone-900 hover:underline"
            >
              Nexpura
            </a>
            {" · "}
            The trusted jewellery management platform
          </p>
        </div>
      </main>
    </div>
  );
}
