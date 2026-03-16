import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ExpenseDetailClient from "./ExpenseDetailClient";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId ?? "")
    .single();

  if (!expense) notFound();

  return <ExpenseDetailClient expense={expense} />;
}
