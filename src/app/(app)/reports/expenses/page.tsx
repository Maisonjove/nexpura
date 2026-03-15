import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import ExpenseReportsClient from "./ExpenseReportsClient";

export const metadata = { title: "Expense Reports — Nexpura" };

export default async function ExpenseReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id ?? "";
  if (!tenantId) redirect("/onboarding");

  const allowed = await hasPermission(user.id, tenantId, "access_reports");
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to access Reports.</p>
      </div>
    );
  }

  return <ExpenseReportsClient />;
}
