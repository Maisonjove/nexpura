"use client";

import { memo, useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { advanceRepairStage } from "./actions";
import type { Repair } from "./RepairsListClient";

const KANBAN_STAGES = [
  { key: "intake", label: "Booked-In" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Completed" },
];

function fmtDue(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function isOverdue(stage: string, due: string | null | undefined) {
  if (!due) return false;
  if (["collected", "cancelled", "ready"].includes(stage)) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function RepairCardInner({ repair }: { repair: Repair }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: repair.id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;
  const overdue = isOverdue(repair.stage, repair.due_date);
  const customerName = repair.customers?.full_name;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white rounded-xl border border-stone-200 p-4 mb-2.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:border-stone-300 transition-all duration-300 cursor-grab active:cursor-grabbing touch-none"
    >
      <Link
        href={`/repairs/${repair.id}`}
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        <p className="font-mono text-[0.6875rem] text-stone-400 tabular-nums">
          {repair.repair_number ?? repair.id.slice(0, 8)}
        </p>
        <p className="font-serif text-base text-stone-900 leading-snug tracking-tight mt-1 line-clamp-2">
          {repair.item_description ?? repair.item_type ?? "—"}
        </p>
        {customerName && (
          <p className="text-xs text-stone-500 mt-1.5 truncate">{customerName}</p>
        )}
        {repair.due_date && (
          <p
            className={`text-xs mt-2 tabular-nums ${
              overdue ? "text-nexpura-oxblood font-medium" : "text-stone-500"
            }`}
          >
            Due {fmtDue(repair.due_date)}
          </p>
        )}
      </Link>
    </div>
  );
}

// L-04 perf fix: pre-fix, RepairCard re-rendered for every card on every
// parent re-render. With ~50+ cards across 7 columns, dragging one card
// pushed drop latency above 100ms on mid-tier hardware. Memoizing per-card
// with a shallow compare on the rendered fields drops re-renders to O(1)
// for the card being dragged. Comparator only checks fields this card
// actually renders — no deep equality on `customers` (only full_name).
const RepairCard = memo(RepairCardInner, (prev, next) => {
  if (prev.repair.id !== next.repair.id) return false;
  if (prev.repair.stage !== next.repair.stage) return false;
  if (prev.repair.due_date !== next.repair.due_date) return false;
  if (prev.repair.repair_number !== next.repair.repair_number) return false;
  if (prev.repair.item_description !== next.repair.item_description) return false;
  if (prev.repair.item_type !== next.repair.item_type) return false;
  if (
    (prev.repair.customers?.full_name ?? null) !==
    (next.repair.customers?.full_name ?? null)
  ) {
    return false;
  }
  return true;
});
RepairCard.displayName = "RepairCard";

function StageColumnInner({
  stage,
  label,
  repairs,
}: {
  stage: string;
  label: string;
  repairs: Repair[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`bg-white border rounded-2xl p-3 min-h-[440px] flex-shrink-0 w-64 transition-colors duration-200 ${
        isOver ? "border-nexpura-bronze ring-2 ring-nexpura-bronze/20" : "border-stone-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-2 py-2">
        <h3 className="text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury">
          {label}
        </h3>
        <span className="text-xs text-stone-500 tabular-nums font-medium">
          {repairs.length}
        </span>
      </div>
      <div>
        {repairs.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-8">No repairs</p>
        ) : (
          repairs.map((r) => <RepairCard key={r.id} repair={r} />)
        )}
      </div>
    </div>
  );
}

// L-04: same memo treatment as RepairCard. Re-renders only when its
// repairs list reference changes (parent uses useMemo to keep stage-
// grouped lists stable when no card moves in/out of the column).
const StageColumn = memo(StageColumnInner);
StageColumn.displayName = "StageColumn";

export default function RepairsKanban({ initialRepairs }: { initialRepairs: Repair[] }) {
  const [repairs, setRepairs] = useState(initialRepairs);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // L-04: pre-fix, the inline `repairs.filter(r => r.stage === stage.key)`
  // ran 7 times per render and produced fresh array refs every time —
  // even when no card moved between columns. Those fresh refs invalidated
  // StageColumn's memo and forced a full re-render. Single-pass grouping
  // via useMemo means columns only see a new array when their own
  // contents change.
  const repairsByStage = useMemo(() => {
    const groups = new Map<string, Repair[]>();
    for (const stage of KANBAN_STAGES) groups.set(stage.key, []);
    for (const r of repairs) {
      const list = groups.get(r.stage);
      if (list) list.push(r);
    }
    return groups;
  }, [repairs]);

  // L-04: stable callback identity so DndContext doesn't re-attach
  // handlers on every parent render.
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const repairId = event.active.id as string;
    const newStage = event.over?.id as string | undefined;
    if (!newStage) return;
    setRepairs((prev) => {
      const repair = prev.find((r) => r.id === repairId);
      if (!repair || repair.stage === newStage) return prev;
      const previousStage = repair.stage;
      // Fire-and-forget the server action from inside the setter so
      // the optimistic update is applied immediately without a
      // separate re-render pass.
      startTransition(async () => {
        const result = await advanceRepairStage(repairId, newStage, "Stage changed via kanban drag");
        if (result?.error) {
          setError(result.error);
          setRepairs((cur) =>
            cur.map((r) => (r.id === repairId ? { ...r, stage: previousStage } : r)),
          );
          setTimeout(() => setError(null), 4000);
        }
      });
      return prev.map((r) => (r.id === repairId ? { ...r, stage: newStage } : r));
    });
  }, []);

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">
          {error}
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage.key}
              label={stage.label}
              repairs={repairsByStage.get(stage.key) ?? []}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
