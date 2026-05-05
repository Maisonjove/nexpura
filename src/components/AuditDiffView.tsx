"use client";

/**
 * Section 4 #8 (audit/diff view) — renders a field-by-field diff
 * between an audit_logs row's old_data + new_data jsonb columns.
 *
 * Pre-fix the activity log surface only showed up to 3 truncated
 * changes per row (`name: Foo → Bar`). For an inventory price-list
 * update or a customer record with many fields, only the first
 * three changes were visible, the rest hidden.
 *
 * This component renders ALL changes, with:
 *   - red strikethrough for removed/old values
 *   - green for added/new values
 *   - dim grey for unchanged fields (collapsible)
 *   - "Created" → green for every newData field
 *   - "Deleted" → red for every oldData field
 *   - JSON-stringified for nested objects + arrays so the user
 *     can see structural changes
 *
 * Reusable: the inline activity-log surface uses it; future per-
 * entity history pages (/customers/[id]/history,
 * /inventory/[id]/history) can use the same component.
 */

import { useState } from "react";

interface AuditDiffViewProps {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  /** When `compact`, hide unchanged fields by default — user can
      toggle to see the full list. Defaults to true to keep the
      activity log readable on a busy day. */
  compact?: boolean;
}

interface FieldDiff {
  key: string;
  oldVal: unknown;
  newVal: unknown;
  changed: boolean;
  added: boolean;
  removed: boolean;
}

function safeStringify(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "(empty)";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function buildDiff(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): FieldDiff[] {
  const allKeys = new Set<string>([
    ...Object.keys(oldData ?? {}),
    ...Object.keys(newData ?? {}),
  ]);
  const rows: FieldDiff[] = [];
  for (const key of allKeys) {
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];
    const inOld = oldData != null && key in oldData;
    const inNew = newData != null && key in newData;
    const changed = inOld && inNew && JSON.stringify(oldVal) !== JSON.stringify(newVal);
    rows.push({
      key,
      oldVal,
      newVal,
      changed,
      added: !inOld && inNew,
      removed: inOld && !inNew,
    });
  }
  // Sort: changed/added/removed first, then unchanged. Within each
  // group, alphabetical for stable rendering.
  return rows.sort((a, b) => {
    const aImportant = a.changed || a.added || a.removed;
    const bImportant = b.changed || b.added || b.removed;
    if (aImportant !== bImportant) return aImportant ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
}

export default function AuditDiffView({
  oldData,
  newData,
  compact = true,
}: AuditDiffViewProps) {
  const diff = buildDiff(oldData, newData);
  const changedCount = diff.filter((d) => d.changed || d.added || d.removed).length;
  const unchangedCount = diff.length - changedCount;
  const [showUnchanged, setShowUnchanged] = useState(!compact);

  if (diff.length === 0) {
    return (
      <p className="text-xs italic text-stone-400">No fields recorded for this change.</p>
    );
  }

  // Created (oldData null + newData populated): every field is "added".
  // Deleted (oldData populated + newData null): every field is "removed".
  const isCreated = !oldData && newData;
  const isDeleted = oldData && !newData;

  return (
    <div className="text-xs space-y-1.5 font-mono" data-testid="audit-diff-view">
      <p className="text-[11px] uppercase tracking-widest text-stone-400 mb-2 font-sans">
        {isCreated && "Created"}
        {isDeleted && "Deleted"}
        {!isCreated && !isDeleted && (
          <>
            {changedCount} {changedCount === 1 ? "change" : "changes"}
            {unchangedCount > 0 && ` · ${unchangedCount} unchanged`}
          </>
        )}
      </p>
      <ul className="space-y-1.5">
        {diff
          .filter((d) => showUnchanged || d.changed || d.added || d.removed)
          .map((d) => (
            <li
              key={d.key}
              className={`grid grid-cols-[140px_1fr] gap-2 items-start px-2 py-1 rounded ${
                d.added
                  ? "bg-emerald-50"
                  : d.removed
                    ? "bg-red-50"
                    : d.changed
                      ? "bg-amber-50"
                      : "text-stone-400"
              }`}
            >
              <span className="text-stone-700 truncate" title={d.key}>
                {d.key}
              </span>
              <div className="space-y-0.5 min-w-0">
                {(d.changed || d.removed) && (
                  <div className="text-red-700 line-through whitespace-pre-wrap break-all">
                    {safeStringify(d.oldVal)}
                  </div>
                )}
                {(d.changed || d.added) && (
                  <div className="text-emerald-700 whitespace-pre-wrap break-all">
                    {safeStringify(d.newVal)}
                  </div>
                )}
                {!d.changed && !d.added && !d.removed && (
                  <div className="text-stone-400 whitespace-pre-wrap break-all">
                    {safeStringify(d.newVal ?? d.oldVal)}
                  </div>
                )}
              </div>
            </li>
          ))}
      </ul>
      {compact && unchangedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowUnchanged((v) => !v)}
          className="text-[11px] text-stone-500 hover:text-stone-900 transition-colors mt-2 font-sans"
        >
          {showUnchanged ? "Hide unchanged fields" : `Show ${unchangedCount} unchanged field${unchangedCount === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}
