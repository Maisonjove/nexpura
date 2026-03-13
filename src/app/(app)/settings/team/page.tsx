import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  const [{ data: members }, { data: tasks }] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId ?? "")
      .order("created_at", { ascending: false }),
  ]);

  return <TeamClient members={members ?? []} tasks={tasks ?? []} />;
}
