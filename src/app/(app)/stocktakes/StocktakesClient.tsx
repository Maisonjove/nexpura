"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusIcon,
  ClipboardDocumentCheckIcon,
  MapPinIcon,
  ArrowRightIcon,
  XMarkIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { createStocktake, createStocktakeWithInventory } from "./actions";
import type { Stocktake } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "nx-badge-success";
    case "in_progress":
      return "nx-badge-warning";
    case "cancelled":
      return "nx-badge-danger";
    default:
      return "nx-badge-neutral";
  }
}

function formatDate(input: string): string {
  return new Date(input).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  stocktakes: Stocktake[];
  tenantId: string;
  userRole: string;
}

export default function StocktakesClient({ stocktakes, tenantId, userRole }: Props) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createStocktake(name.trim(), location, notes);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/stocktakes/${result.id}`);
    });
  }

  function handleCreateWithInventory() {
    const autoName =
      name.trim() ||
      `Stocktake ${new Date().toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`;
    startTransition(async () => {
      const result = await createStocktakeWithInventory(autoName, location, notes);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/stocktakes/${result.id}`);
    });
  }

  function closeModal() {
    setShowNew(false);
    setError(null);
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Inventory
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Stocktakes
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Count and reconcile your inventory across showrooms and storage.
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Stocktake
          </button>
        </div>

        {/* List */}
        {stocktakes.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <ClipboardDocumentCheckIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No stocktakes yet
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              Create your first stocktake to begin counting inventory and reconciling against your records.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              New Stocktake
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {stocktakes.map((st) => {
              const showCounts =
                st.status === "completed" || st.status === "in_progress";
              const hasVariance = st.total_discrepancies > 0;
              return (
                <Link
                  key={st.id}
                  href={`/stocktakes/${st.id}`}
                  className="group block bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2.5">
                        {st.reference_number && (
                          <span className="font-mono text-xs text-stone-400 tabular-nums">
                            {st.reference_number}
                          </span>
                        )}
                        <span className={statusBadgeClass(st.status)}>
                          {STATUS_LABELS[st.status] ?? st.status}
                        </span>
                      </div>
                      <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        {st.name}
                      </h3>

                      <div className="flex items-center gap-x-6 gap-y-2 mt-4 text-xs text-stone-500 flex-wrap">
                        {st.location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPinIcon className="w-3.5 h-3.5 text-stone-400" />
                            {st.location}
                          </span>
                        )}
                        <span>
                          Created{" "}
                          <span className="text-stone-700">
                            {formatDate(st.created_at)}
                          </span>
                        </span>
                        {st.completed_at && (
                          <span>
                            Completed{" "}
                            <span className="text-stone-700">
                              {formatDate(st.completed_at)}
                            </span>
                          </span>
                        )}
                      </div>

                      {showCounts && (
                        <div className="flex items-center gap-x-6 gap-y-2 mt-3 text-xs flex-wrap">
                          <span className="text-stone-500">
                            <span className="text-stone-700 font-medium tabular-nums">
                              {st.total_items_counted}
                            </span>{" "}
                            counted
                          </span>
                          {hasVariance && (
                            <span className="inline-flex items-center gap-1.5 text-stone-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span className="text-stone-700 font-medium tabular-nums">
                                {st.total_discrepancies}
                              </span>{" "}
                              variance{st.total_discrepancies !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 self-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300">
                        View
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* New stocktake modal */}
      {showNew && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
              <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                New Stocktake
              </h2>
              <button
                onClick={closeModal}
                className="text-stone-400 hover:text-stone-700 transition-colors duration-200"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. End of Month Count – March 2026"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Location
                </label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Main Showroom, Back Office…"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex flex-col gap-3 pt-5 border-t border-stone-200 -mx-6 px-6 -mb-6 pb-6">
                <button
                  onClick={handleCreateWithInventory}
                  disabled={isPending}
                  className="nx-btn-primary inline-flex items-center justify-center gap-2 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArchiveBoxIcon className="w-4 h-4" />
                  {isPending ? "Creating…" : "Import from Inventory"}
                </button>
                <p className="text-xs text-stone-400 text-center leading-relaxed">
                  Pre-populates every stock item, ready for counting.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isPending || !name.trim()}
                    className="px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Creating…" : "Create empty"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
