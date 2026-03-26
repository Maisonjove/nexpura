import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "heavy");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: userData } = await admin.from("users").select("tenant_id").eq("id", user.id).single();
  const tenantId = userData?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const category = searchParams.get("category") ?? "all";
  let query = admin
    .from("expenses")
    .select("id, description, category, amount, invoice_ref, expense_date, created_at")
    .eq("tenant_id", tenantId)
    .order("expense_date", { ascending: false });

  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);
  if (category && category !== "all") query = query.eq("category", category);

  const { data: expenses, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ expenses: expenses ?? [] });
  // Cache expense reports for 5 minutes (private — user-specific)
  res.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=60");
  return res;
}
