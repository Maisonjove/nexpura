import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import ExpenseListClient from "./ExpenseListClient";

export const metadata = { title: "Expenses — Nexpura" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id ?? "";

  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, description, category, amount, invoice_ref, expense_date, created_at")
    .eq("tenant_id", tenantId)
    .order("expense_date", { ascending: false });

  // Monthly totals by category
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: monthExpenses } = await supabase
    .from("expenses")
    .select("category, amount")
    .eq("tenant_id", tenantId)
    .gte("expense_date", monthStart)
    .lte("expense_date", monthEnd);

  const categories = ["stock", "rent", "utilities", "marketing", "staffing", "equipment", "repairs", "other"];
  const totals: Record<string, number> = {};
  for (const cat of categories) totals[cat] = 0;
  for (const e of monthExpenses ?? []) {
    totals[e.category] = (totals[e.category] ?? 0) + (e.amount || 0);
  }

  const monthTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  return (
    <ExpenseListClient
      expenses={expenses ?? []}
      monthTotals={totals}
      monthTotal={monthTotal}
      month={now.toLocaleString("en-AU", { month: "long", year: "numeric" })}
    />
  );
}
