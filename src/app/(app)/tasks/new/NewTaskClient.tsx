"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createTask } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";

const LINKED_TYPE_LABELS: Record<string, string> = {
  repair: "Repair",
  bespoke: "Bespoke Job",
  inventory: "Inventory",
  supplier: "Supplier",
};

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
}

interface Props {
  teamMembers: TeamMember[];
}

export default function NewTaskClient({ teamMembers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from query params (when linking from repair/bespoke)
  const linkedType = searchParams.get("linked_type") || "";
  const linkedId = searchParams.get("linked_id") || "";
  const stage = searchParams.get("stage") || "";
  const defaultTitle = stage
    ? `${linkedType === "repair" ? "Repair" : "Bespoke"} — ${stage.replace(/_/g, " ")} stage task`
    : "";

  const [form, setForm] = useState({
    title: defaultTitle,
    description: "",
    assigned_to: "",
    due_date: "",
    priority: "normal",
    status: "todo",
    linked_type: linkedType,
    linked_id: linkedId,
    notes: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    startTransition(async () => {
      try {
        const result = await createTask(fd);
        if (result?.error) {
          setError(result.error);
        } else {
          router.push("/tasks");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : "Save failed. Please try again.");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/tasks"
        className="text-sm text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1"
      >
        ← Back to Tasks
      </Link>
      <h1 className="text-2xl font-semibold text-stone-900 mt-4 mb-8">New Task</h1>

      <form onSubmit={handleSubmit}>
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="What needs to be done?"
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Additional details..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Assign To</label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 bg-white"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 bg-white"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 bg-white"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Link to</label>
            <select
              value={form.linked_type}
              onChange={(e) => setForm((p) => ({ ...p, linked_type: e.target.value, linked_id: "" }))}
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 bg-white"
            >
              <option value="">None</option>
              <option value="repair">Repair</option>
              <option value="bespoke">Bespoke Job</option>
              <option value="inventory">Inventory Item</option>
              <option value="supplier">Supplier</option>
            </select>
          </div>

          {form.linked_type && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {LINKED_TYPE_LABELS[form.linked_type]} ID
              </label>
              <input
                type="text"
                value={form.linked_id}
                onChange={(e) => setForm((p) => ({ ...p, linked_id: e.target.value }))}
                placeholder="Paste ID here"
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Internal notes..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-stone-100">
            <SubmitButton
              isPending={isPending}
              idleLabel="Create Task"
              pendingLabel="Creating…"
              className="px-5 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50"
            />
            <Link
              href="/tasks"
              className="px-4 py-2.5 border border-stone-200 text-stone-600 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
