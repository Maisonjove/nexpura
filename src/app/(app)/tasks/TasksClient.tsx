"use client";

import { useState, useTransition, useEffect , Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Paperclip, User, List, Wrench, Gem, Link as LinkIcon } from "lucide-react";
import { createTask, updateTask, deleteTask, getTaskComments, addTaskComment, getTaskAttachments, deleteTaskAttachment } from "./actions";
import type { StaffTask, TaskComment, TaskAttachment } from "./actions";
import TaskKanbanView from "./TaskKanbanView";
import { SubmitButton } from "@/components/ui/submit-button";

const PRIORITY_COLOURS: Record<string, string> = {
  low: "bg-stone-100 text-stone-500",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-600",
};

const STATUS_COLOURS: Record<string, string> = {
  pending: "bg-stone-100 text-stone-600",
  in_progress: "bg-amber-50 text-amber-700",
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

function TasksClientInner({ userId, userRole, myTasks, allTasks, teamMembers, tenantId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const activeTab = (searchParams.get('tab') || 'my') as "my" | "all";
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [showNewTask, setShowNewTask] = useState(false);

  // Pre-fill from repair/bespoke "Create Task" links
  useEffect(() => {
    const isNew = searchParams.get("new");
    const linkedType = searchParams.get("linked_type");
    const linkedId = searchParams.get("linked_id");
    const stage = searchParams.get("stage");
    if (isNew && linkedType && linkedId) {
      setForm((f) => ({
        ...f,
        linked_type: linkedType,
        linked_id: linkedId,
        title: stage ? `${linkedType === "repair" ? "Repair" : "Bespoke"} — ${stage.replace(/_/g, " ")} stage task` : f.title,
      }));
      setShowNewTask(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);

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
    priority: "normal",
    status: "todo",
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
        setForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "normal", status: "todo", linked_type: "", linked_id: "", notes: "" });
        router.refresh();
      }
    });
  }

  function handleStatusChange(taskId: string, status: string) {
    startTransition(async () => {
      await updateTask(taskId, { status });
      router.refresh();
      const label = status === "completed" ? "Task marked as done ✓" : `Task moved to ${status.replace("_", " ")}`;
      showMsg(label);
    });
  }

  function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    startTransition(async () => {
      await deleteTask(taskId);
      router.refresh();
    });
  }

  async function openTaskDetail(task: StaffTask) {
    setSelectedTask(task);
    const [commentsResult, attachmentsResult] = await Promise.all([
      getTaskComments(task.id),
      getTaskAttachments(task.id),
    ]);
    setTaskComments(commentsResult.data);
    setTaskAttachments(attachmentsResult.data);
  }

  async function handleAddComment() {
    if (!selectedTask || !commentText.trim()) return;
    setAddingComment(true);
    const result = await addTaskComment(selectedTask.id, commentText.trim());
    if (result.data) {
      setTaskComments((prev) => [...prev, result.data!]);
      setCommentText("");
    }
    setAddingComment(false);
  }

  const displayTasks = filterTasks(activeTab === "my" ? myTasks : allTasks);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Task detail slide-out */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedTask(null)} />
          <div className="w-full max-w-md bg-white border-l border-stone-200 flex flex-col overflow-hidden shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <h3 className="text-base font-semibold text-stone-900 truncate pr-2">{selectedTask.title}</h3>
              <button onClick={() => setSelectedTask(null)} className="text-stone-400 hover:text-stone-600 text-lg flex-shrink-0">✕</button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Status + Priority */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedTask.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setSelectedTask((prev) => prev ? { ...prev, status: newStatus } : null);
                    startTransition(async () => { await updateTask(selectedTask.id, { status: newStatus }); router.refresh(); });
                  }}
                  className="text-xs border border-stone-200 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PRIORITY_COLOURS[selectedTask.priority] || "bg-stone-100 text-stone-600"}`}>
                  {selectedTask.priority}
                </span>
                {selectedTask.due_date && (
                  <span className="text-xs text-stone-500">Due: {selectedTask.due_date}</span>
                )}
              </div>
              {/* Description */}
              {selectedTask.description && (
                <p className="text-sm text-stone-600 leading-relaxed">{selectedTask.description}</p>
              )}
              {/* Linked entity */}
              {selectedTask.linked_type && selectedTask.linked_id && (
                <div>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Linked To</p>
                  <Link
                    href={`${LINKED_TYPE_HREFS[selectedTask.linked_type] || "/"}${selectedTask.linked_id}`}
                    className="text-sm text-amber-700 hover:underline"
                  >
                    {LINKED_TYPE_LABELS[selectedTask.linked_type] || selectedTask.linked_type} ↗
                  </Link>
                </div>
              )}
              {/* Assignee */}
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Assigned To</p>
                {selectedTask.assigned_to ? (
                  <p className="text-sm text-stone-700">{teamMembers.find((m) => m.id === selectedTask.assigned_to)?.full_name ?? "Unknown"}</p>
                ) : (
                  <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">Unassigned</span>
                )}
              </div>
              {/* Notes */}
              {selectedTask.notes && (
                <div>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-stone-600">{selectedTask.notes}</p>
                </div>
              )}
              {/* Attachments */}
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Attachments ({taskAttachments.length})</p>
                {taskAttachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {taskAttachments.map((a) => {
                      const isImage = a.file_type?.startsWith("image/");
                      return (
                        <div key={a.id} className="relative border border-stone-200 rounded-lg overflow-hidden group">
                          {isImage ? (
                            <Image src={a.file_url} alt={a.file_name} width={200} height={80} className="w-full h-20 object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-20 bg-stone-50 flex items-center justify-center">
                              <Paperclip className="w-6 h-6 text-nexpura-taupe-400" strokeWidth={1.5} />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs truncate">{a.file_name}</span>
                            <button
                              onClick={async () => {
                                await deleteTaskAttachment(a.id);
                                setTaskAttachments((prev) => prev.filter((x) => x.id !== a.id));
                              }}
                              className="text-white/60 hover:text-red-400 ml-1 text-xs"
                            >✕</button>
                          </div>
                          <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0" />
                        </div>
                      );
                    })}
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer hover:text-amber-700 border border-dashed border-stone-200 rounded-lg px-3 py-2 hover:border-amber-600 transition-colors mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attach file or image
                  <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !selectedTask) return;
                    // Upload to Supabase storage
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("task_id", selectedTask.id);
                    try {
                      const res = await fetch("/api/tasks/upload-attachment", { method: "POST", body: formData });
                      const data = await res.json() as { attachment?: TaskAttachment; error?: string };
                      if (data.attachment) {
                        setTaskAttachments((prev) => [data.attachment!, ...prev]);
                      }
                    } catch {
                      // silently fail
                    }
                  }} />
                </label>
              </div>

              {/* Comments */}
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Comments ({taskComments.length})</p>
                <div className="space-y-2 mb-3">
                  {taskComments.map((c) => (
                    <div key={c.id} className="bg-stone-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-stone-400">{new Date(c.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-sm text-stone-700">{c.content}</p>
                    </div>
                  ))}
                  {taskComments.length === 0 && <p className="text-xs text-stone-400 italic">No comments yet</p>}
                </div>
                <textarea
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30 resize-none mb-2"
                />
                <button
                  onClick={handleAddComment}
                  disabled={addingComment || !commentText.trim()}
                  className="w-full py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 disabled:opacity-50 transition-colors"
                >
                  {addingComment ? "Adding…" : "Add Comment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                aria-label="List view"
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1 ${viewMode === "list" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                <List className="w-3 h-3" strokeWidth={1.5} /> List
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                title="Kanban board"
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "kanban" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                ⊞ Board
              </button>
            </div>
            <Link
              href="/tasks/new"
              className="px-3 py-1.5 bg-[#071A0D] text-white text-xs font-medium rounded-lg hover:bg-stone-800 transition-colors"
            >
              + New Task
            </Link>
          </div>
        </div>
      </div>

      {msg && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white rounded-xl px-5 py-3 text-sm font-medium shadow-xl animate-in fade-in slide-in-from-bottom-2">
          {msg}
        </div>
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
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Assign To</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
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
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
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
                <label className="block text-xs text-stone-500 mb-1">Link to</label>
                <select
                  value={form.linked_type}
                  onChange={(e) => setForm((p) => ({ ...p, linked_type: e.target.value, linked_id: "" }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
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
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <SubmitButton
                  isPending={isPending}
                  idleLabel="Create Task"
                  pendingLabel="Creating…"
                  className="flex-1 py-2.5 bg-nexpura-charcoal text-white rounded-xl font-medium text-sm hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                />
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
            onClick={() => router.replace(pathname)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === "my"
                ? "border-b-2 border-amber-600 text-amber-700"
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
              onClick={() => router.replace(pathname + '?tab=all')}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "border-b-2 border-amber-600 text-amber-700"
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
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
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
            <option value="normal">Normal</option>
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

        {/* Kanban view */}
        {viewMode === "kanban" ? (
          <div className="p-4">
            <TaskKanbanView
              tasks={displayTasks}
              teamMembers={teamMembers}
              onTaskUpdate={() => router.refresh()}
            />
          </div>
        ) : null}

        {/* Tasks list */}
        {viewMode === "list" && displayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-stone-700">No tasks found</p>
            <p className="text-sm text-stone-500 mt-1">Tasks assigned to your team will appear here</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="divide-y divide-stone-100">
            {displayTasks.map((task) => {
              const overdue = isOverdue(task);
              const assignee = teamMembers.find((m) => m.id === task.assigned_to);
              return (
                <div
                  key={task.id}
                  className={`px-5 py-4 flex items-start gap-4 cursor-pointer hover:bg-stone-50/50 transition-colors ${overdue ? "bg-red-50/40" : ""}`}
                  onClick={() => openTaskDetail(task)}
                >
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
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {assignee ? (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                          <User className="w-3 h-3" strokeWidth={1.5} />
                          {assignee.full_name}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                          Unassigned
                        </span>
                      )}
                      {task.linked_type && task.linked_id && (
                        <Link
                          href={`${LINKED_TYPE_HREFS[task.linked_type] || "/"}${task.linked_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border transition-colors hover:underline ${
                            task.linked_type === "repair" || task.linked_type === "bespoke"
                              ? "bg-nexpura-champagne text-nexpura-bronze border-nexpura-taupe-100"
                              : "bg-stone-50 text-stone-600 border-stone-200"
                          }`}
                        >
                          {task.linked_type === "repair" ? (
                            <Wrench className="w-3 h-3" strokeWidth={1.5} />
                          ) : task.linked_type === "bespoke" ? (
                            <Gem className="w-3 h-3" strokeWidth={1.5} />
                          ) : (
                            <LinkIcon className="w-3 h-3" strokeWidth={1.5} />
                          )}
                          {" "}{LINKED_TYPE_LABELS[task.linked_type] || task.linked_type}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {(task.status === "todo" || task.status === "pending") && (
                      <button
                        onClick={() => handleStatusChange(task.id, "in_progress")}
                        disabled={isPending}
                        className="text-xs text-amber-700 hover:text-stone-800 px-2 py-1 rounded transition-colors disabled:opacity-50"
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
        ) : null}
      </div>
    </div>
  );
}
export default function TasksClient(props: Parameters<typeof TasksClientInner>[0]) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <TasksClientInner {...props} />
    </Suspense>
  );
}
