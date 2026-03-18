import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  normal: "Normal",
  low: "Low",
};

const PRIORITY_COLOUR: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  normal: "bg-amber-100 text-amber-700",
  low: "bg-stone-100 text-stone-500",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
};

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export default async function ReviewTasksPage() {
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("id, title, description, priority, status, due_date, assigned_to, related_type, related_id, created_at")
    .eq("tenant_id", TENANT_ID)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false });

  const allTasks = tasks ?? [];
  const todayTasks = allTasks.filter((t) => t.due_date === today);
  const upcomingTasks = allTasks.filter((t) => t.due_date && t.due_date > today);
  const overdueTasks = allTasks.filter((t) => t.due_date && t.due_date < today);
  const unscheduledTasks = allTasks.filter((t) => !t.due_date);

  const completedCount = 0; // neq filter above means we don't fetch completed

  function TaskCard({ task }: { task: typeof allTasks[0] }) {
    const overdue = isOverdue(task.due_date);
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-800 leading-snug">{task.title}</p>
            {task.description && (
              <p className="text-xs text-stone-400 mt-1 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOUR[task.priority ?? "normal"] ?? "bg-stone-100 text-stone-500"}`}>
                {PRIORITY_LABEL[task.priority ?? "normal"] ?? task.priority}
              </span>
              {task.due_date && (
                <span className={`text-xs ${overdue ? "text-red-600 font-semibold" : "text-stone-400"}`}>
                  {overdue ? "⚠ Overdue · " : ""}{formatDate(task.due_date)}
                </span>
              )}
              {task.related_type && (
                <span className="text-xs text-stone-400 capitalize">{task.related_type.replace("_", " ")}</span>
              )}
            </div>
          </div>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
            task.status === "in_progress" ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"
          }`}>
            {STATUS_LABEL[task.status ?? "todo"] ?? task.status}
          </span>
        </div>
      </div>
    );
  }

  function Section({ title, tasks, badge, badgeColour }: { title: string; tasks: typeof allTasks; badge?: string; badgeColour?: string }) {
    if (tasks.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-widest">{title}</h2>
          {badge && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColour ?? "bg-stone-100 text-stone-500"}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Tasks</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {allTasks.length} open task{allTasks.length !== 1 ? "s" : ""}
            {todayTasks.length > 0 && ` · ${todayTasks.length} due today`}
            {overdueTasks.length > 0 && ` · ${overdueTasks.length} overdue`}
          </p>
        </div>
        <Link href="/review/workshop" className="text-xs text-stone-500 hover:text-stone-800 underline">
          Workshop view →
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
          Could not load tasks: {error.message}
        </div>
      )}

      {allTasks.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <p className="text-stone-400 text-sm">No open tasks for this tenant.</p>
        </div>
      )}

      <Section
        title="Due Today"
        tasks={todayTasks}
        badge={todayTasks.length > 0 ? String(todayTasks.length) : undefined}
        badgeColour="bg-amber-100 text-amber-700"
      />
      <Section
        title="Overdue"
        tasks={overdueTasks}
        badge={overdueTasks.length > 0 ? String(overdueTasks.length) : undefined}
        badgeColour="bg-red-100 text-red-700"
      />
      <Section title="Upcoming" tasks={upcomingTasks} />
      <Section title="Unscheduled" tasks={unscheduledTasks} />
    </div>
  );
}

