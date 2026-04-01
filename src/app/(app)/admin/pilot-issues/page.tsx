import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import PilotIssuesClient from "./PilotIssuesClient";
import type { PilotIssue } from "./types";

export const metadata = { title: "Pilot Issues — Nexpura Internal" };

export default async function PilotIssuesPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  // Only owners can access this internal tool
  if (!auth.isOwner) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">This internal tool is only accessible to account owners.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  // Fetch all issues
  const { data: issues } = await admin
    .from("pilot_issues")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch tenant list for dropdown
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name")
    .order("name");

  return (
    <PilotIssuesClient
      issues={(issues ?? []) as PilotIssue[]}
      tenants={tenants ?? []}
      currentUserId={auth.userId}
      currentUserEmail={auth.email}
    />
  );
}
