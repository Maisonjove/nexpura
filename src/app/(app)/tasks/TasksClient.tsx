"use client";

import { useState, useTransition, useEffect , Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  PaperClipIcon,
  UserIcon,
  ListBulletIcon,
  XMarkIcon,
  PlusIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  Squares2X2Icon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { createTask, updateTask, deleteTask, getTaskComments, addTaskComment, getTaskAttachments, deleteTaskAttachment } from "./actions";
import type { StaffTask, TaskComment, TaskAttachment } from "./actions";
import TaskKanbanView from "./TaskKanbanView";
import { SubmitButton } from "@/components/ui/submit-button";

const PRIORITY_BADGE: Record<string, string> = {
  low: "nx-badge-neutral",
  normal: "nx-badge-neutral",
  medium: "nx-badge-warning",
  high: "nx-badge-warning",
  urgent: "nx-badge-danger",
};

const STATUS_BADGE: Record<string, string> = {
  todo: "nx-badge-neutral",
  pending: "nx-badge-neutral",
  in_progress: "nx-badge-warning",
  blocked: "nx-badge-danger",
  done: "nx-badge-success",
  completed: "nx-badge-success",
  cancelled: "nx-badge-neutral",
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

function isCompleted(status: string): boolean {
  return status === "completed" || status === "done";
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
      const label = status === "completed" ? "Task marked as done" : `Task moved to ${status.replace("_", " ")}`;
      showMsg(label);
    });
  }

  function handleToggleComplete(task: StaffTask) {
    const nextStatus = isCompleted(task.status) ? "todo" : "completed";
    handleStatusChange(task.id, nextStatus);
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

  // Filter pill helper
  const pillClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 ${
      active
        ? "bg-stone-900 text-white"
        : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
    }`;

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Task detail slide-out */}
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-stone-900/40 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
            <div className="w-full max-w-md bg-white border-l border-stone-200 flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.12)]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
                <h3 className="font-serif text-xl text-stone-900 tracking-tight truncate pr-2">{selectedTask.title}</h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-stone-400 hover:text-stone-700 transition-colors duration-200 flex-shrink-0"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status + Priority */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedTask.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      setSelectedTask((prev) => prev ? { ...prev, status: newStatus } : null);
                      startTransition(async () => { await updateTask(selectedTask.id, { status: newStatus }); router.refresh(); });
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-stone-200 bg-white text-stone-700 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <span className={PRIORITY_BADGE[selectedTask.priority] || "nx-badge-neutral"}>
                    {selectedTask.priority}
                  </span>
                  {selectedTask.due_date && (
                    <span className="text-xs text-stone-500 tabular-nums">
                      Due {new Date(selectedTask.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                {/* Description */}
                {selectedTask.description && (
                  <p className="text-sm text-stone-600 leading-relaxed">{selectedTask.description}</p>
                )}
                {/* Linked entity */}
                {selectedTask.linked_type && selectedTask.linked_id && (
                  <div>
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">Linked To</p>
                    <Link
                      href={`${LINKED_TYPE_HREFS[selectedTask.linked_type] || "/"}${selectedTask.linked_id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                    >
                      {LINKED_TYPE_LABELS[selectedTask.linked_type] || selectedTask.linked_type}
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
                {/* Assignee */}
                <div>
                  <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">Assigned To</p>
                  {selectedTask.assigned_to ? (
                    <p className="text-sm text-stone-700">{teamMembers.find((m) => m.id === selectedTask.assigned_to)?.full_name ?? "Unknown"}</p>
                  ) : (
                    <span className="nx-badge-neutral">Unassigned</span>
                  )}
                </div>
                {/* Notes */}
                {selectedTask.notes && (
                  <div>
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">Notes</p>
                    <p className="text-sm text-stone-600 leading-relaxed">{selectedTask.notes}</p>
                  </div>
                )}
                {/* Attachments */}
                <div>
                  <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">Attachments ({taskAttachments.length})</p>
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
                                <PaperClipIcon className="w-6 h-6 text-stone-400" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-stone-900/60 px-2 py-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-xs truncate">{a.file_name}</span>
                              <button
                                onClick={async () => {
                                  await deleteTaskAttachment(a.id);
                                  setTaskAttachments((prev) => prev.filter((x) => x.id !== a.id));
                                }}
                                className="text-white/70 hover:text-red-300 ml-1"
                                aria-label="Remove attachment"
                              >
                                <XMarkIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer hover:text-nexpura-bronze border border-dashed border-stone-200 rounded-lg px-3 py-2 hover:border-nexpura-bronze transition-colors">
                    <PaperClipIcon className="w-4 h-4" />
                    Attach file or image
                    <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !selectedTask) return;
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
                  <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">Comments ({taskComments.length})</p>
                  <div className="space-y-2 mb-3">
                    {taskComments.map((c) => (
                      <div key={c.id} className="bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-stone-400 tabular-nums">{new Date(c.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-sm text-stone-700 leading-relaxed">{c.content}</p>
                      </div>
                    ))}
                    {taskComments.length === 0 && <p className="text-xs text-stone-400 italic">No comments yet</p>}
                  </div>
                  <textarea
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none mb-2"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={addingComment || !commentText.trim()}
                    className="nx-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingComment ? "Adding…" : "Add Comment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Operations
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              Tasks
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              {overdueCount > 0 && (
                <span className="text-stone-900 font-medium tabular-nums">{overdueCount} overdue</span>
              )}
              {overdueCount > 0 && <span className="text-stone-300 mx-2">·</span>}
              Track, assign, and complete work across the workshop and showroom.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap lg:justify-end">
            <Link
              href="/tasks/workshop"
              className="px-4 py-2 text-sm font-medium rounded-full border border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-all duration-300"
            >
              Workshop View
            </Link>
            <div className="flex items-center bg-white border border-stone-200 rounded-full p-0.5">
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                aria-label="List view"
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 inline-flex items-center gap-1.5 ${viewMode === "list" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"}`}
              >
                <ListBulletIcon className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                title="Kanban board"
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 inline-flex items-center gap-1.5 ${viewMode === "kanban" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"}`}
              >
                <Squares2X2Icon className="w-3.5 h-3.5" /> Board
              </button>
            </div>
            <button
              onClick={() => setShowNewTask(true)}
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>

        {msg && (
          <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white rounded-full px-5 py-3 text-sm font-medium shadow-[0_12px_32px_rgba(0,0,0,0.18)] animate-in fade-in slide-in-from-bottom-2">
            {msg}
          </div>
        )}

        {/* New Task Modal */}
        {showNewTask && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
                <h2 className="font-serif text-2xl text-stone-900 tracking-tight">New Task</h2>
                <button
                  onClick={() => setShowNewTask(false)}
                  className="text-stone-400 hover:text-stone-700 transition-colors duration-200"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Assign To</label>
                    <select
                      value={form.assigned_to}
                      onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
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
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Link to</label>
                  <select
                    value={form.linked_type}
                    onChange={(e) => setForm((p) => ({ ...p, linked_type: e.target.value, linked_id: "" }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
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
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">{LINKED_TYPE_LABELS[form.linked_type]} ID</label>
                    <input
                      type="text"
                      value={form.linked_id}
                      onChange={(e) => setForm((p) => ({ ...p, linked_id: e.target.value }))}
                      placeholder="Paste ID here"
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 font-mono placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                    />
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 -mx-6 px-6 -mb-6 pb-6">
                  <button
                    type="button"
                    onClick={() => setShowNewTask(false)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <SubmitButton
                    isPending={isPending}
                    idleLabel="Create Task"
                    pendingLabel="Creating…"
                    className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => router.replace(pathname)}
            className={pillClass(activeTab === "my")}
          >
            My Tasks
            {myTasks.length > 0 && (
              <span className={`ml-2 text-[0.6875rem] rounded-full px-2 py-0.5 tabular-nums ${activeTab === "my" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600"}`}>
                {myTasks.length}
              </span>
            )}
          </button>
          {canSeeAll && (
            <button
              onClick={() => router.replace(pathname + '?tab=all')}
              className={pillClass(activeTab === "all")}
            >
              All Tasks
              {allTasks.length > 0 && (
                <span className={`ml-2 text-[0.6875rem] rounded-full px-2 py-0.5 tabular-nums ${activeTab === "all" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600"}`}>
                  {allTasks.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-3 flex-wrap mb-8">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-full border border-stone-200 bg-white text-sm text-stone-700 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
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
            className="px-4 py-2 rounded-full border border-stone-200 bg-white text-sm text-stone-700 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
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
              className="px-4 py-2 rounded-full border border-stone-200 bg-white text-sm text-stone-700 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
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
          <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
            <TaskKanbanView
              tasks={displayTasks}
              teamMembers={teamMembers}
              onTaskUpdate={() => router.refresh()}
            />
          </div>
        ) : null}

        {/* Tasks list */}
        {viewMode === "list" && displayTasks.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center">
            <ClipboardDocumentCheckIcon className="w-8 h-8 text-stone-300 mx-auto mb-6" strokeWidth={1.5} />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              No tasks found
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-8">
              Tasks assigned to your team will appear here. Create one to get started.
            </p>
            <button
              onClick={() => setShowNewTask(true)}
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              New Task
            </button>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-4">
            {displayTasks.map((task) => {
              const overdue = isOverdue(task);
              const assignee = teamMembers.find((m) => m.id === task.assigned_to);
              const completed = isCompleted(task.status);
              return (
                <div
                  key={task.id}
                  className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer"
                  onClick={() => openTaskDetail(task)}
                >
                  <div className="flex items-start gap-5">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(task);
                      }}
                      disabled={isPending}
                      aria-label={completed ? "Mark as incomplete" : "Mark as complete"}
                      className={`mt-1 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-300 ${
                        completed
                          ? "bg-nexpura-bronze border-nexpura-bronze text-white"
                          : "bg-white border-stone-300 hover:border-nexpura-bronze"
                      }`}
                    >
                      {completed && <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className={`font-serif text-xl leading-tight tracking-tight transition-all duration-300 ${
                        completed ? "line-through text-stone-400" : "text-stone-900"
                      }`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className={`text-sm mt-1.5 leading-relaxed line-clamp-2 transition-colors duration-300 ${
                          completed ? "text-stone-400" : "text-stone-500"
                        }`}>{task.description}</p>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <span className={STATUS_BADGE[task.status] || "nx-badge-neutral"}>
                          {task.status.replace("_", " ")}
                        </span>
                        <span className={PRIORITY_BADGE[task.priority] || "nx-badge-neutral"}>
                          {task.priority}
                        </span>
                        {overdue && (
                          <span className="nx-badge-danger">Overdue</span>
                        )}
                        {assignee ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                            <UserIcon className="w-3.5 h-3.5" />
                            {assignee.full_name}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">Unassigned</span>
                        )}
                        {task.due_date && (
                          <span className={`text-xs tabular-nums ${overdue ? "text-stone-900 font-medium" : "text-stone-500"}`}>
                            Due {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {task.linked_type && task.linked_id && (
                          <Link
                            href={`${LINKED_TYPE_HREFS[task.linked_type] || "/"}${task.linked_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                          >
                            {LINKED_TYPE_LABELS[task.linked_type] || task.linked_type}
                            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={(e) => e.stopPropagation()}>
                      {(task.status === "todo" || task.status === "pending") && (
                        <button
                          onClick={() => handleStatusChange(task.id, "in_progress")}
                          disabled={isPending}
                          className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-nexpura-bronze rounded-full transition-colors duration-200 disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(task.id)}
                        disabled={isPending}
                        className="p-1.5 text-stone-300 hover:text-stone-700 rounded-full transition-colors duration-200 disabled:opacity-50"
                        aria-label="Delete task"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
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
