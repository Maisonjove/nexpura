"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface ReviewItem {
  slug: string;
  label: string;
  feedback: string;
  beforePath: string;
  afterPath: string;
  legacyFile: string;
  pending?: boolean;
}

interface Props {
  items: ReviewItem[];
  totalConfirmed: number;
}

type Variant = "before" | "after";

export default function FeedbackReviewClient({ items, totalConfirmed }: Props) {
  const router = useRouter();
  const [activeSlug, setActiveSlug] = useState<string | null>(items[0]?.slug ?? null);
  const [variants, setVariants] = useState<Record<string, Variant>>(() =>
    Object.fromEntries(items.map((i) => [i.slug, "after" as Variant])),
  );
  const [confirming, setConfirming] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const active = items.find((i) => i.slug === activeSlug) ?? null;
  const totalItems = items.length + totalConfirmed;
  const allDone = items.length === 0;

  const setVariant = (slug: string, v: Variant) =>
    setVariants((prev) => ({ ...prev, [slug]: v }));

  const handleConfirm = async (slug: string) => {
    setConfirming(slug);
    try {
      const res = await fetch("/feedback-review/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to confirm");
      }
      startTransition(() => {
        router.refresh();
        setActiveSlug((prev) => {
          const remaining = items.filter((i) => i.slug !== slug);
          return remaining[0]?.slug ?? null;
        });
      });
    } catch (err) {
      alert(`Could not confirm: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[0.75rem] tracking-luxury uppercase text-stone-400 mb-3">
            Design Review
          </p>
          <h1 className="font-serif text-4xl lg:text-5xl text-stone-900 leading-[1.08] tracking-[-0.01em] mb-4">
            Feedback review
          </h1>
          <p className="text-stone-500 text-base leading-relaxed max-w-[640px]">
            Toggle between the original page and the redesigned version. When you&apos;re happy
            with a page, confirm to keep the new version and remove the snapshot.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono tabular-nums text-stone-900 text-lg">
                {totalConfirmed}
              </span>
              <span className="text-stone-400">/ {totalItems} confirmed</span>
            </div>
            <div className="flex-1 h-1 bg-stone-200 rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full bg-nexpura-bronze transition-all duration-500"
                style={{
                  width: totalItems === 0 ? "0%" : `${(totalConfirmed / totalItems) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {allDone ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 mx-auto flex items-center justify-center mb-5">
              <svg
                className="w-8 h-8 text-emerald-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h2 className="font-serif text-3xl text-stone-900 mb-2">All confirmed</h2>
            <p className="text-stone-500 max-w-md mx-auto">
              Every redesign has been confirmed and the legacy snapshots have been removed.
              You&apos;re free to delete this review page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* Sidebar list */}
            <aside className="space-y-1.5">
              {items.map((it) => {
                const isActive = it.slug === activeSlug;
                return (
                  <button
                    key={it.slug}
                    onClick={() => setActiveSlug(it.slug)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                      isActive
                        ? "bg-white border-stone-300 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                        : "bg-white/60 border-stone-200 hover:bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[0.9375rem] font-medium ${
                          isActive ? "text-stone-900" : "text-stone-700"
                        }`}
                      >
                        {it.label}
                      </span>
                      <span className="text-[0.6875rem] tracking-luxury uppercase text-stone-400">
                        {variants[it.slug] === "before" ? "Before" : "After"}
                      </span>
                    </div>
                    <p className="text-[0.75rem] text-stone-400 leading-relaxed line-clamp-2">
                      {it.feedback}
                    </p>
                  </button>
                );
              })}
            </aside>

            {/* Main panel */}
            {active && (
              <main className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col min-h-[700px]">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-stone-200 bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-serif text-xl text-stone-900 truncate">
                      {active.label}
                    </span>
                    <span className="text-[0.75rem] tracking-luxury uppercase text-stone-400 hidden sm:inline">
                      Comparison
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle */}
                    <div className="flex items-center bg-stone-100 rounded-full p-1">
                      <button
                        onClick={() => setVariant(active.slug, "before")}
                        className={`px-4 py-1.5 rounded-full text-[0.8125rem] font-medium transition-all duration-300 cursor-pointer ${
                          variants[active.slug] === "before"
                            ? "bg-white text-stone-900 shadow-sm"
                            : "text-stone-500 hover:text-stone-700"
                        }`}
                      >
                        Before
                      </button>
                      <button
                        onClick={() => setVariant(active.slug, "after")}
                        className={`px-4 py-1.5 rounded-full text-[0.8125rem] font-medium transition-all duration-300 cursor-pointer ${
                          variants[active.slug] === "after"
                            ? "bg-white text-stone-900 shadow-sm"
                            : "text-stone-500 hover:text-stone-700"
                        }`}
                      >
                        After
                      </button>
                    </div>

                    {/* Open in new tab */}
                    <a
                      href={
                        variants[active.slug] === "before"
                          ? active.beforePath
                          : active.afterPath
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-md text-[0.8125rem] font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors duration-200 cursor-pointer"
                      title="Open in new tab"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                    </a>

                    {/* Confirm */}
                    <button
                      onClick={() => handleConfirm(active.slug)}
                      disabled={confirming === active.slug}
                      className="nx-btn-primary cursor-pointer text-[0.8125rem] px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {confirming === active.slug ? "Confirming…" : "Confirm after"}
                    </button>
                  </div>
                </div>

                {/* Iframe stage */}
                <div className="flex-1 bg-stone-50 relative">
                  {items.map((it) =>
                    it.slug === active.slug ? (
                      <iframe
                        key={`${it.slug}-${variants[it.slug]}`}
                        src={
                          variants[it.slug] === "before" ? it.beforePath : it.afterPath
                        }
                        title={`${it.label} — ${variants[it.slug]}`}
                        className="absolute inset-0 w-full h-full bg-white"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                      />
                    ) : null,
                  )}
                </div>
              </main>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
