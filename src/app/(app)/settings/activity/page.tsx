import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import ActivityLogClient from "./ActivityLogClient";

export const metadata = { title: "Activity Log — Nexpura" };

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; user?: string; type?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");
  
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  
  if (!userData?.tenant_id) redirect("/onboarding");
  
  // Only admins and owners can view activity log
  if (!["admin", "owner", "super_admin"].includes(userData.role || "")) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="font-serif text-[28px] leading-tight text-nexpura-charcoal mb-3">Access Denied</h1>
        <p className="text-nexpura-charcoal-500">You don&apos;t have permission to view the activity log.</p>
        <Link href="/settings" className="text-nexpura-charcoal-500 hover:text-nexpura-charcoal mt-4 inline-block transition-colors">
          ← Back to Settings
        </Link>
      </div>
    );
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const perPage = 50;
  const userFilter = params.user || "";
  const typeFilter = params.type || "";
  const dateFrom = params.from || "";
  const dateTo = params.to || "";
  
  const admin = createAdminClient();
  
  // Build query
  let query = admin
    .from("audit_logs")
    .select("*, users(full_name, email)", { count: "exact" })
    .eq("tenant_id", userData.tenant_id)
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  
  if (userFilter) {
    query = query.eq("user_id", userFilter);
  }
  
  if (typeFilter) {
    query = query.eq("entity_type", typeFilter);
  }
  
  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }
  
  if (dateTo) {
    query = query.lte("created_at", dateTo + "T23:59:59");
  }
  
  const { data: logs, count } = await query;
  
  // Get team members for filter
  const { data: teamMembers } = await admin
    .from("users")
    .select("id, full_name, email")
    .eq("tenant_id", userData.tenant_id)
    .order("full_name");
  
  const totalPages = Math.ceil((count || 0) / perPage);
  
  return (
    <ActivityLogClient
      logs={logs || []}
      teamMembers={teamMembers || []}
      page={page}
      totalPages={totalPages}
      totalCount={count || 0}
      userFilter={userFilter}
      typeFilter={typeFilter}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  );
}
