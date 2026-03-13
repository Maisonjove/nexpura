"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTask, updateTask, deleteTask } from "./actions";
import type { StaffTask } from "./actions";

const PRIORITY_COLOURS: Record<string, string> = {
  low: "bg-stone-100 text-stone-500",
  medium: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-600",
};

const STATUS_COLOURS: Record<string, string> = {
  pending: "bg-stone-100 text-stone-600",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-400",
};

const LINKED_TYPE_LABELS: Record<string, string> = {
  repair: "Repair",
  bespoke: "Bespoke Job",
  inventory: "Inventory",
  supplier: "Supplier",
};

const LINKED_TYPE_HREFS: Record<string, string> = {
  repair: "/repairs/",
  bespoke: "/bespoke/",
  inventory: "/inventory/",
  supplier: "/suppliers/",
};

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
}

interface Props {
  userId: string;
  userRole: string;
  myTasks: StaffTask[];
  allTasks: StaffTask[];
  teamMembers: TeamMember[];
  tenantId: string;
}

function isOverdue(task: StaffTask): boolean {
  if (!task.due_date) return false;
  if (task.status === "completed" || task.status === "cancelled") return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

export default function TasksClient({ userId, userRole, myTasks, allTasks, teamMembers, tenantId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");
  const [showNewTask, setShowNewTask] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  // New task form
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    due_date: "",
    priority: "medium",
    status: "pending",
    linked_type: "",
    linked_id: "",
    notes: "",
  });

  const canSeeAll = userRole === "owner" || userRole === "manager";
  const overdueCount = myTasks.filter(isOverdue).length;

  function showMsg(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 3000);
  }

  function filterTasks(tasks: StaffTask[]) {
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assigned_to !== assigneeFilter) return false;
      return true;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    startTransition(async () => {
      const result = await createTask(fd);
      if (result.error) showMsg(`Error: ${result.error}`);
      else {
        showMsg("Task created!");
        setShowNewTask(false);
        setForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "medium", status: "pending", linked_type: "", linked_id: "", notes: "" });
        router.refresh();
      }
    });
  }

  function handleStatusChange(taskId: string, status: string) {
    startTransition(async () => {
      await updateTask(taskId, { status });
      router.refresh();
    });
  }

  function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    startTransition(async () => {
      await deleteTask(taskId);
      router.refresh();
    });
  }

  const displayTasks = filterTasks(activeTab === "my" ? myTasks : allTasks);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Tasks</h1>
          <p className="text-stone-500 mt-1 text-sm">
            {overdueCount > 0 && (
              <span className="text-red-600 font-medium">{overdueCount} overdue · </span>
            )}
            Manage your work tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/tasks/workshop"
            className="px-3 py-1.5 bg-stone-100 text-stone-700 text-xs font-medium rounded-lg hover:bg-stone-200 transition-colors"
          >
            Workshop View
          </Link>
          <button
            onClick={() => setShowNewTask(true)}
            className="px-3 py-1.5 bg-[#071A0D] text-white text-xs font-medium rounded-lg hover:bg-stone-800 transition-colors"
          >
            + New Task
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">{msg}</div>
      )}

      {/* New Task Modal */}
      {showNewTask && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">New Task</h3>
              <button onClick={() => setShowNewTask(false)} className="text-stone-400 hover:text-stone-900">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Title *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Assign To</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Link to</label>
                <select
                  value={form.linked_type}
                  onChange={(e) => setForm((p) => ({ ...p, linked_type: e.target.value, linked_id: "" }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
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
                  <label className="block text-xs text-stone-500 mb-1">{LINKED_TYPE_LABELS[form.linked_type]} ID</label>
                  <input
                    type="text"
                    value={form.linked_id}
                    onChange={(e) => setForm((p) => ({ ...p, linked_id: e.target.value }))}
                    placeholder="Paste ID here"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 bg-[#8B7355] text-white rounded-xl font-medium text-sm hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                >
                  {isPending ? "Creating…" : "Create Task"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTask(false)}
                  className="px-4 py-2.5 text-stone-500 text-sm hover:text-stone-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm">
        <div className="flex border-b border-stone-200">
          <button
            onClick={() => setActiveTab("my")}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === "my"
                ? "border-b-2 border-[#8B7355] text-[#8B7355]"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            My Tasks
            {myTasks.length > 0 && (
              <span className="ml-2 bg-stone-100 text-stone-600 text-xs rounded-full px-2 py-0.5">
                {myTasks.length}
              </span>
            )}
          </button>
          {canSeeAll && (
            <button
              onClick={() => setActiveTab("all")}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "border-b-2 border-[#8B7355] text-[#8B7355]"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              All Tasks
              {allTasks.length > 0 && (
                <span className="ml-2 bg-stone-100 text-stone-600 text-xs rounded-full px-2 py-0.5">
                  {allTasks.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-stone-100 flex gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-600 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-600 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          {canSeeAll && activeTab === "all" && (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-600 focus:outline-none"
            >
              <option value="">All Assignees</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tasks list */}
        {displayTasks.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-stone-400">
            {activeTab === "my" ? "No tasks assigned to you" : "No tasks yet"}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {displayTasks.map((task) => {
              const overdue = isOverdue(task);
              const assignee = teamMembers.find((m) => m.id === task.assigned_to);
              return (
                <div key={task.id} className={`px-5 py-4 flex items-start gap-4 ${overdue ? "bg-red-50/40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[task.status] || "bg-stone-100 text-stone-600"}`}>
                        {task.status.replace("_", " ")}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLOURS[task.priority] || "bg-stone-100 text-stone-600"}`}>
                        {task.priority}
                      </span>
                      {overdue && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          Overdue
                        </span>
                      )}
                      {task.due_date && (
                        <span className={`text-xs ${overdue ? "text-red-500" : "text-stone-400"}`}>
                          Due {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-stone-400" : "text-stone-900"}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-stone-500 mt-0.5 truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {assignee && (
                        <span className="text-xs text-stone-400">→ {assignee.full_name}</span>
                      )}
                      {task.linked_type && task.linked_id && (
                        <Link
                          href={`${LINKED_TYPE_HREFS[task.linked_type] || "/"}${task.linked_id}`}
                          className="text-xs text-[#8B7355] hover:underline"
                        >
                          {LINKED_TYPE_LABELS[task.linked_type] || task.linked_type} ↗
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {task.status === "pending" && (
                      <button
                        onClick={() => handleStatusChange(task.id, "in_progress")}
                        disabled={isPending}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        Start
                      </button>
                    )}
                    {task.status !== "completed" && task.status !== "cancelled" && (
                      <button
                        onClick={() => handleStatusChange(task.id, "completed")}
                        disabled={isPending}
                        className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        ✓ Done
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      disabled={isPending}
                      className="text-xs text-stone-300 hover:text-red-400 px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
