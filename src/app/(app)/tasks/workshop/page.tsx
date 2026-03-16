import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Workshop Tasks — Nexpura" };

const STATUS_COLOURS: Record<string, string> = {
  pending: "bg-stone-100 text-stone-600",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-400",
};

const PRIORITY_COLOURS: Record<string, string> = {
  low: "bg-stone-100 text-stone-500",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-600",
};

export default async function WorkshopTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  const tenantId = userData.tenant_id;

  // Fetch workshop tasks
  const { data: tasks } = await admin
    .from("tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("linked_type", ["repair", "bespoke"])
    .order("due_date", { ascending: true, nullsFirst: false });

  // Group by linked entity
  const grouped = new Map<string, typeof tasks>();
  for (const task of tasks ?? []) {
    const key = `${task.linked_type}:${task.linked_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(task);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Workshop Tasks</h1>
          <p className="text-stone-500 mt-1 text-sm">Tasks linked to repairs and bespoke jobs</p>
        </div>
        <Link href="/tasks" className="text-sm text-amber-700 hover:underline">← All Tasks</Link>
      </div>

      {grouped.size === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-400 text-sm">
          No workshop tasks yet
        </div>
      ) : (
        Array.from(grouped.entries()).map(([key, groupTasks]) => {
          const [linkedType, linkedId] = key.split(":");
          const href = linkedType === "repair" ? `/repairs/${linkedId}` : `/bespoke/${linkedId}`;
          const label = linkedType === "repair" ? "Repair" : "Bespoke Job";
          const activeTasks = (groupTasks ?? []).filter((t) => t.status !== "completed" && t.status !== "cancelled");
          const completedTasks = (groupTasks ?? []).filter((t) => t.status === "completed");

          return (
            <div key={key} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div>
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">{label}</span>
                  <Link href={href} className="ml-2 text-sm font-semibold text-amber-700 hover:underline font-mono">
                    {linkedId?.slice(0, 8)}… ↗
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span className="text-green-600">{completedTasks.length} done</span>
                  <span>·</span>
                  <span>{activeTasks.length} pending</span>
                </div>
              </div>
              <div className="divide-y divide-stone-100">
                {(groupTasks ?? []).map((task) => (
                  <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[task.status] || ""}`}>
                          {task.status.replace("_", " ")}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLOURS[task.priority] || ""}`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-stone-400" : "text-stone-900"}`}>
                        {task.title}
                      </p>
                    </div>
                    {task.due_date && (
                      <span className="text-xs text-stone-400 flex-shrink-0">
                        {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
