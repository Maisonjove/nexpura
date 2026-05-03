"use client";

import { useState, useTransition } from "react";
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
  { key: "intake", label: "Intake" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
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

function RepairCard({ repair }: { repair: Repair }) {
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
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-lg border ${
        overdue ? "border-nexpura-oxblood/40" : "border-stone-200"
      } p-3 mb-2 shadow-sm cursor-grab active:cursor-grabbing touch-none`}
    >
      <Link
        href={`/repairs/${repair.id}`}
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        <p className="text-xs font-mono text-stone-500">{repair.repair_number ?? repair.id.slice(0, 8)}</p>
        <p className="text-sm font-medium text-stone-900 mt-1 line-clamp-2">
          {(repair as { item_description?: string | null }).item_description ?? "—"}
        </p>
        {repair.due_date && (
          <p className={`text-xs mt-1 ${overdue ? "text-nexpura-oxblood font-medium" : "text-stone-500"}`}>
            Due {fmtDue(repair.due_date)}
          </p>
        )}
      </Link>
    </div>
  );
}

function StageColumn({
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
      className={`bg-stone-50 rounded-xl p-3 min-h-[400px] flex-shrink-0 w-64 ${
        isOver ? "ring-2 ring-amber-500/50" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">{label}</h3>
        <span className="text-xs text-stone-500">{repairs.length}</span>
      </div>
      <div>
        {repairs.map((r) => (
          <RepairCard key={r.id} repair={r} />
        ))}
      </div>
    </div>
  );
}

export default function RepairsKanban({ initialRepairs }: { initialRepairs: Repair[] }) {
  const [repairs, setRepairs] = useState(initialRepairs);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const repairId = event.active.id as string;
    const newStage = event.over?.id as string | undefined;
    if (!newStage) return;
    const repair = repairs.find((r) => r.id === repairId);
    if (!repair || repair.stage === newStage) return;

    // Optimistic update
    const previousStage = repair.stage;
    setRepairs((prev) => prev.map((r) => (r.id === repairId ? { ...r, stage: newStage } : r)));

    startTransition(async () => {
      const result = await advanceRepairStage(repairId, newStage, "Stage changed via kanban drag");
      if (result?.error) {
        setError(result.error);
        // Revert
        setRepairs((prev) => prev.map((r) => (r.id === repairId ? { ...r, stage: previousStage } : r)));
        setTimeout(() => setError(null), 4000);
      }
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage.key}
              label={stage.label}
              repairs={repairs.filter((r) => r.stage === stage.key)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
