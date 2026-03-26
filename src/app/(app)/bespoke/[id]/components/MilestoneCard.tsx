"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Plus, Trash2, Calendar } from "lucide-react";

export interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  order_index: number;
}

interface MilestoneCardProps {
  jobId: string;
  tenantId: string;
  milestones: Milestone[];
  readOnly?: boolean;
  onMilestoneChange?: () => void;
}

const DEFAULT_TEMPLATES = [
  "Design Concept",
  "Client Approval",
  "Source Materials",
  "Create / Make",
  "Quality Check",
  "Final Delivery",
];

export default function MilestoneCard({
  jobId,
  tenantId,
  milestones: initialMilestones,
  readOnly = false,
  onMilestoneChange,
}: MilestoneCardProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function addMilestone(title: string, desc?: string, dueDate?: string) {
    const nextOrder = milestones.length;
    const res = await fetch("/api/bespoke/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, tenantId, title, description: desc || null, due_date: dueDate || null, order_index: nextOrder }),
    });
    const data = await res.json();
    if (data.error) {
      showToastMsg(`Error: ${data.error}`);
    } else {
      setMilestones(prev => [...prev, data.milestone]);
      showToastMsg("✓ Milestone added");
      onMilestoneChange?.();
    }
  }

  async function toggleComplete(m: Milestone) {
    if (readOnly) return;
    const completed_at = m.completed_at ? null : new Date().toISOString();
    const res = await fetch(`/api/bespoke/milestones/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, completed_at }),
    });
    const data = await res.json();
    if (!data.error) {
      setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, completed_at } : x));
      onMilestoneChange?.();
    }
  }

  async function deleteMilestone(id: string) {
    if (!confirm("Delete this milestone?")) return;
    const res = await fetch(`/api/bespoke/milestones/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (res.ok) {
      setMilestones(prev => prev.filter(x => x.id !== id));
      onMilestoneChange?.();
    }
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    startTransition(async () => {
      await addMilestone(newTitle.trim(), newDesc.trim(), newDueDate);
      setNewTitle("");
      setNewDesc("");
      setNewDueDate("");
      setShowAdd(false);
    });
  }

  async function applyTemplate() {
    startTransition(async () => {
      for (let i = 0; i < DEFAULT_TEMPLATES.length; i++) {
        await fetch("/api/bespoke/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, tenantId, title: DEFAULT_TEMPLATES[i], order_index: milestones.length + i }),
        });
      }
      // Refresh
      const res = await fetch(`/api/bespoke/milestones?jobId=${jobId}&tenantId=${tenantId}`);
      const data = await res.json();
      if (data.milestones) setMilestones(data.milestones);
      showToastMsg("✓ Default milestones applied");
      onMilestoneChange?.();
    });
  }

  const completed = milestones.filter(m => m.completed_at).length;
  const total = milestones.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">Milestone Timeline</h3>
          {total > 0 && (
            <p className="text-xs text-stone-500 mt-0.5">{completed}/{total} complete · {pct}%</p>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            {total === 0 && (
              <button
                onClick={applyTemplate}
                disabled={isPending}
                className="text-xs text-stone-500 border border-stone-200 px-2.5 py-1.5 rounded-lg hover:bg-stone-50 transition"
              >
                Use template
              </button>
            )}
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 text-xs font-medium bg-stone-900 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-4">
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAddSubmit} className="mb-4 p-3 bg-stone-50 rounded-xl space-y-2 border border-stone-200">
          <input
            type="text"
            placeholder="Milestone title *"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
            required
            autoFocus
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <input
            type="date"
            value={newDueDate}
            onChange={e => setNewDueDate(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !newTitle.trim()}
              className="flex-1 text-sm font-medium bg-stone-900 text-white px-3 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50 transition"
            >
              Add Milestone
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm text-stone-500 px-3 py-2 rounded-lg hover:bg-stone-100 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Milestones list */}
      {milestones.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-stone-300 text-3xl mb-2">◎</div>
          <p className="text-sm text-stone-400">No milestones yet</p>
          {!readOnly && (
            <p className="text-xs text-stone-400 mt-1">Add milestones or use the default template</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {milestones
            .sort((a, b) => a.order_index - b.order_index)
            .map((m, idx) => (
              <div
                key={m.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                  m.completed_at
                    ? "bg-emerald-50 border-emerald-100"
                    : "bg-white border-stone-100 hover:border-stone-200"
                }`}
              >
                {/* Timeline connector */}
                <div className="flex flex-col items-center mt-0.5">
                  <button
                    onClick={() => toggleComplete(m)}
                    disabled={readOnly}
                    className={`rounded-full transition ${
                      m.completed_at
                        ? "text-emerald-500 hover:text-emerald-600"
                        : "text-stone-300 hover:text-stone-500"
                    } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {m.completed_at ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                  {idx < milestones.length - 1 && (
                    <div className="w-px h-4 bg-stone-200 mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${m.completed_at ? "line-through text-stone-400" : "text-stone-900"}`}>
                    {m.title}
                  </p>
                  {m.description && (
                    <p className="text-xs text-stone-500 mt-0.5">{m.description}</p>
                  )}
                  <div className="flex gap-3 mt-1">
                    {m.due_date && (
                      <span className="flex items-center gap-1 text-xs text-stone-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(m.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </span>
                    )}
                    {m.completed_at && (
                      <span className="text-xs text-emerald-500">
                        ✓ Done {new Date(m.completed_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>

                {!readOnly && (
                  <button
                    onClick={() => deleteMilestone(m.id)}
                    className="text-stone-300 hover:text-red-400 transition ml-1 mt-0.5 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
