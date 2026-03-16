"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTask } from "./actions";
import type { StaffTask } from "./actions";

const LINKED_TYPE_HREFS: Record<string, string> = {
  repair: "/repairs/",
  bespoke: "/bespoke/",
  inventory: "/inventory/",
  supplier: "/suppliers/",
};

const COLUMNS: { id: string; label: string; color: string; dot: string }[] = [
  { id: "pending", label: "To Do", color: "bg-stone-50 border-stone-200", dot: "bg-stone-400" },
  { id: "in_progress", label: "In Progress", color: "bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  { id: "completed", label: "Done", color: "bg-green-50 border-green-200", dot: "bg-green-500" },
];

const PRIORITY_DOTS: Record<string, string> = {
  low: "🔵",
  medium: "🟡",
  high: "🟠",
  urgent: "🔴",
};

interface TeamMember { id: string; full_name: string; }

interface Props {
  tasks: StaffTask[];
  teamMembers: TeamMember[];
  onTaskUpdate?: () => void;
}

export default function TaskKanbanView({ tasks, teamMembers, onTaskUpdate }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<StaffTask[]>(tasks);
  const [isPending, startTransition] = useTransition();

  const memberMap = new Map(teamMembers.map((m) => [m.id, m.full_name]));

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  }

  function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault();
    if (!draggingId) return;
    const task = localTasks.find((t) => t.id === draggingId);
    if (!task || task.status === newStatus) {
      setDraggingId(null);
      setDragOverCol(null);
      return;
    }

    // Optimistic update
    setLocalTasks((prev) => prev.map((t) =>
      t.id === draggingId ? { ...t, status: newStatus } : t
    ));
    setDraggingId(null);
    setDragOverCol(null);

    startTransition(async () => {
      await updateTask(draggingId, { status: newStatus });
      onTaskUpdate?.();
    });
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colTasks = localTasks.filter((t) => t.status === col.id);
        const isOver = dragOverCol === col.id;

        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-72 rounded-xl border-2 transition-colors ${col.color} ${isOver ? "border-amber-600" : ""}`}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragLeave={() => setDragOverCol(null)}
          >
            <div className="px-4 py-3 flex items-center gap-2 border-b border-inherit">
              <div className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className="text-sm font-semibold text-stone-800">{col.label}</span>
              <span className="ml-auto text-xs text-stone-400 bg-white/60 px-2 py-0.5 rounded-full font-medium">
                {colTasks.length}
              </span>
            </div>
            <div className="p-3 space-y-2 min-h-32">
              {colTasks.map((task) => {
                const isOverdue = task.due_date && task.status !== "completed" && new Date(task.due_date) < new Date();
                const assigneeName = task.assigned_to ? memberMap.get(task.assigned_to) : null;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-lg border border-stone-200 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none hover:shadow-md transition-shadow ${
                      draggingId === task.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-1.5 mb-2">
                      <span className="text-xs mt-0.5">{PRIORITY_DOTS[task.priority] ?? "⚪"}</span>
                      <p className="text-sm font-medium text-stone-900 leading-snug">{task.title}</p>
                    </div>
                    {task.description && (
                      <p className="text-xs text-stone-400 mb-2 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {task.due_date && (
                        <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-stone-400"}`}>
                          {isOverdue ? "⚠️ " : "📅 "}
                          {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {assigneeName && (
                        <div className="flex items-center gap-1 ml-auto">
                          <div className="w-5 h-5 rounded-full bg-amber-700/20 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-amber-700">
                              {assigneeName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {task.linked_type && task.linked_id && (
                      <div className="mt-2">
                        <Link
                          href={`${LINKED_TYPE_HREFS[task.linked_type] || "/"}${task.linked_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border hover:underline transition-colors ${
                            task.linked_type === "repair"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : task.linked_type === "bespoke"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-stone-50 text-stone-500 border-stone-200"
                          }`}
                        >
                          {task.linked_type === "repair" ? "🔧" : task.linked_type === "bespoke" ? "💎" : "🔗"}
                          {" "}{task.linked_type === "repair" ? "Repair" : task.linked_type === "bespoke" ? "Bespoke" : task.linked_type}
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
              {colTasks.length === 0 && !isOver && (
                <div className="text-center py-8 text-xs text-stone-300">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
