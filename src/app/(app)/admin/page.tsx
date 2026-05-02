import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import AdminHubClient from "./AdminHubClient";

export const metadata = { title: "Admin — Nexpura" };

/**
 * Tenant Admin Hub — Section 11 of Kaitlyn's 2026-05-02 redesign brief.
 * cacheComponents requires sync top-level + dynamic body inside Suspense.
 */
export default function AdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <AdminHubBody />
    </Suspense>
  );
}

async function AdminHubBody() {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const admin = createAdminClient();

  const todayIso = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  const [
    tasksDueResult,
    teamInvitesResult,
    billingResult,
    supportResult,
  ] = await Promise.all([
    // Tasks due today or overdue, not done.
    admin
      .from("tasks")
      .select("id, title, status, due_date, priority")
      .eq("tenant_id", tenantId)
      .lte("due_date", todayIso)
      .not("status", "in", '("done","completed","cancelled")')
      .order("due_date", { ascending: true })
      .limit(20),
    // Pending team invites — schema-tolerant.
    admin
      .from("team_invites")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
    // Billing — pull tenant subscription / plan status.
    admin
      .from("tenants")
      .select("subscription_status, plan, trial_ends_at")
      .eq("id", tenantId)
      .maybeSingle(),
    // Support requests — schema-tolerant.
    admin
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("status", "in", '("closed","resolved")'),
  ]);

  const tasks = tasksDueResult.data ?? [];
  const tasksDueCount = tasks.length;
  const topTasks = tasks.slice(0, 3).map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    priority: t.priority,
  }));

  // Pending setup is currently a placeholder — stubbed to 0 until the
  // setup-checklist feature lands. Documented so it can be wired up.
  const pendingSetup = 0;

  const teamInvites = teamInvitesResult.error ? 0 : (teamInvitesResult.count ?? 0);
  const supportRequests = supportResult.error ? 0 : (supportResult.count ?? 0);

  const billing = billingResult.data;
  const billingStatus =
    billing?.subscription_status === "trialing"
      ? "Trial"
      : billing?.subscription_status === "active"
        ? "Active"
        : billing?.subscription_status === "past_due"
          ? "Past due"
          : billing?.subscription_status === "canceled"
            ? "Canceled"
            : "—";

  return (
    <AdminHubClient
      panel={{
        tasksDueCount,
        topTasks,
        pendingSetup,
        teamInvites,
        billingStatus,
        supportRequests,
      }}
    />
  );
}
