"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createStocktake } from "./actions";
import type { Stocktake } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

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

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Stocktakes</h1>
          <p className="text-sm text-stone-500 mt-0.5">Count and reconcile your inventory</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium hover:bg-[#7A6347] transition-colors"
        >
          + New Stocktake
        </button>
      </div>

      {/* New stocktake modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">New Stocktake</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1 block">Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. End of Month Count – March 2026"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1 block">Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Main Showroom, Back Office…"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1 block">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowNew(false); setError(null); }}
                className="flex-1 px-3 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !name.trim()}
                className="flex-1 px-3 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium hover:bg-[#7A6347] disabled:opacity-60"
              >
                {isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {stocktakes.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-medium text-stone-600">No stocktakes yet</p>
          <p className="text-sm mt-1">Create your first stocktake to begin counting inventory</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stocktakes.map((st) => (
            <Link
              key={st.id}
              href={`/stocktakes/${st.id}`}
              className="block bg-white rounded-xl border border-stone-200 hover:border-[#8B7355]/40 hover:shadow-sm transition-all p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-stone-900">{st.name}</span>
                    {st.reference_number && (
                      <span className="text-xs text-stone-400 font-mono">{st.reference_number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-400 flex-wrap">
                    {st.location && <span>📍 {st.location}</span>}
                    <span>Created {new Date(st.created_at).toLocaleDateString("en-AU")}</span>
                    {st.completed_at && (
                      <span>✓ Completed {new Date(st.completed_at).toLocaleDateString("en-AU")}</span>
                    )}
                  </div>
                  {(st.status === "completed" || st.status === "in_progress") && (
                    <div className="flex gap-4 mt-2 text-xs text-stone-500">
                      <span>🔢 {st.total_items_counted} counted</span>
                      {st.total_discrepancies > 0 && (
                        <span className="text-amber-600">⚠️ {st.total_discrepancies} discrepancies</span>
                      )}
                    </div>
                  )}
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[st.status] ?? "bg-stone-100 text-stone-600"}`}>
                  {STATUS_LABELS[st.status] ?? st.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
