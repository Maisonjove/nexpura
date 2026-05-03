"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2, Loader2 } from "lucide-react";

/**
 * Migration rollback action — Group 13 audit. Pre-fix the only way to
 * undo a bad import was to drop into a SQL shell and DELETE rows by
 * hand. Now: a confirm-modal-gated client button that POSTs to
 * /api/migration/rollback and shows the deletion counts per table.
 */
export function RollbackButton({ sessionId, sessionStatus }: { sessionId: string; sessionStatus: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deletedByTable: Record<string, number>; totalDeleted: number } | null>(null);

  // Only completed/failed sessions can be rolled back. Drafts haven't
  // run yet; anything else is in-flight.
  if (!["complete", "complete_with_errors", "failed"].includes(sessionStatus)) {
    return null;
  }

  if (result) {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">✓</div>
          <div className="flex-1">
            <h3 className="font-semibold text-stone-900 text-sm">Rollback complete</h3>
            <p className="text-stone-500 text-xs mt-0.5">{result.totalDeleted} records removed across {Object.keys(result.deletedByTable).length} table{Object.keys(result.deletedByTable).length === 1 ? "" : "s"}.</p>
            <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
              {Object.entries(result.deletedByTable).map(([t, n]) => (
                <li key={t}>{t}: <span className="font-mono">{n}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
        <div className="flex items-start gap-3">
          <Undo2 className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-stone-900 text-sm">Roll back this import?</h3>
            <p className="text-stone-700 text-xs mt-1">
              All records imported by this session will be removed. Soft-deleteable tables (customers, inventory, repairs, bespoke_jobs, invoices, suppliers) get marked deleted; everything else is hard-deleted. Audit-logged. This cannot be undone — re-running the migration starts a fresh session.
            </p>
            {error && (
              <p className="text-red-600 text-xs mt-2">{error}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      const res = await fetch("/api/migration/rollback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionId, confirm: true }),
                      });
                      const body = await res.json();
                      if (!res.ok) {
                        setError(body.error ?? `Request failed (${res.status})`);
                        return;
                      }
                      setResult({ deletedByTable: body.deletedByTable ?? {}, totalDeleted: body.totalDeleted ?? 0 });
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Network error");
                    }
                  });
                }}
                disabled={pending}
                className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? <><Loader2 className="w-3 h-3 animate-spin" /> Rolling back…</> : "Yes, roll back"}
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); setError(null); }}
                disabled={pending}
                className="text-xs font-medium px-3 py-1.5 border border-stone-200 rounded-md hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-red-600 transition-colors"
    >
      <Undo2 className="w-3.5 h-3.5" />
      Rollback this import
    </button>
  );
}
