"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  createTask,
  updateTaskStatus,
} from "./actions";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  invite_accepted: boolean;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

interface Props {
  members: TeamMember[];
  tasks: Task[];
}

const ROLE_COLOURS: Record<string, string> = {
  owner: "bg-purple-50 text-purple-700",
  manager: "bg-blue-50 text-blue-700",
  staff: "bg-stone-100 text-stone-700",
  technician: "bg-amber-50 text-amber-700",
};

const PRIORITY_COLOURS: Record<string, string> = {
  low: "bg-stone-100 text-stone-500",
  normal: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-600",
};

const STATUS_COLOURS: Record<string, string> = {
  todo: "bg-stone-100 text-stone-600",
  in_progress: "bg-blue-50 text-blue-700",
  done: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-400",
};

export default function TeamClient({ members, tasks }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showInvite, setShowInvite] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [taskDue, setTaskDue] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function showMsg(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 4000);
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", inviteName);
    fd.append("email", inviteEmail);
    fd.append("role", inviteRole);
    startTransition(async () => {
      const result = await inviteTeamMember(fd);
      if (result?.error) showMsg(`Error: ${result.error}`);
      else {
        showMsg("Team member invited!");
        setShowInvite(false);
        setInviteName("");
        setInviteEmail("");
        router.refresh();
      }
    });
  }

  function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", taskTitle);
    fd.append("description", taskDesc);
    fd.append("priority", taskPriority);
    fd.append("due_date", taskDue);
    fd.append("assigned_to", taskAssignee);
    startTransition(async () => {
      const result = await createTask(fd);
      if (result?.error) showMsg(`Error: ${result.error}`);
      else {
        showMsg("Task created!");
        setShowTask(false);
        setTaskTitle("");
        setTaskDesc("");
        setTaskDue("");
        setTaskAssignee("");
        router.refresh();
      }
    });
  }

  function handleRemove(memberId: string) {
    if (!confirm("Remove this team member?")) return;
    startTransition(async () => {
      await removeTeamMember(memberId);
      router.refresh();
    });
  }

  function handleRoleChange(memberId: string, role: string) {
    startTransition(async () => {
      await updateTeamMemberRole(memberId, role);
      router.refresh();
    });
  }

  function handleTaskStatus(taskId: string, status: string) {
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
      router.refresh();
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Team</h1>
        <p className="text-stone-500 mt-1">Manage your team and track tasks.</p>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
          {msg}
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Team Members</h2>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="px-3 py-1.5 bg-[#071A0D] text-white text-xs font-medium rounded-lg hover:bg-stone-800 transition-colors"
          >
            + Invite
          </button>
        </div>

        {showInvite && (
          <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
            <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-[#52B788]"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#52B788]"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]"
                >
                  <option value="staff">Staff</option>
                  <option value="technician">Technician</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-2 bg-[#52B788] text-white text-sm font-medium rounded-lg hover:bg-[#3d9068] transition-colors disabled:opacity-50"
                >
                  {isPending ? "…" : "Invite"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-3 py-2 text-stone-500 text-sm hover:text-stone-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-stone-400">No team members yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-3 text-sm font-medium text-stone-900">{m.name}</td>
                  <td className="px-4 py-3 text-sm text-stone-500">{m.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      disabled={isPending}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${ROLE_COLOURS[m.role] || "bg-stone-100 text-stone-600"}`}
                    >
                      <option value="staff">Staff</option>
                      <option value="technician">Technician</option>
                      <option value="manager">Manager</option>
                      <option value="owner">Owner</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${m.invite_accepted ? "text-green-600" : "text-amber-600"}`}>
                      {m.invite_accepted ? "Active" : "Invited"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={isPending}
                      className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tasks */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Tasks</h2>
          <button
            onClick={() => setShowTask(!showTask)}
            className="px-3 py-1.5 bg-[#071A0D] text-white text-xs font-medium rounded-lg hover:bg-stone-800 transition-colors"
          >
            + New Task
          </button>
        </div>

        {showTask && (
          <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-stone-500 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-[#52B788] text-white text-sm font-medium rounded-lg hover:bg-[#3d9068] transition-colors disabled:opacity-50"
                >
                  {isPending ? "…" : "Create Task"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTask(false)}
                  className="px-4 py-2 text-stone-500 text-sm hover:text-stone-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-stone-400">No tasks yet</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {tasks.map((task) => (
              <div key={task.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[task.status] || "bg-stone-100 text-stone-600"}`}>
                      {task.status.replace("_", " ")}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLOURS[task.priority] || "bg-stone-100 text-stone-600"}`}>
                      {task.priority}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-stone-400">
                        Due: {new Date(task.due_date).toLocaleDateString("en-AU")}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-stone-400" : "text-stone-900"}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-stone-500 mt-0.5">{task.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {task.status !== "done" && (
                    <button
                      onClick={() => handleTaskStatus(task.id, "done")}
                      disabled={isPending}
                      className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      ✓ Done
                    </button>
                  )}
                  {task.status === "todo" && (
                    <button
                      onClick={() => handleTaskStatus(task.id, "in_progress")}
                      disabled={isPending}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      Start
                    </button>
                  )}
                  {task.status !== "cancelled" && task.status !== "done" && (
                    <button
                      onClick={() => handleTaskStatus(task.id, "cancelled")}
                      disabled={isPending}
                      className="text-xs text-stone-400 hover:text-red-500 px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
