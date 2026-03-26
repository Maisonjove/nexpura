import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/qa - Fetch all QA data
export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") || "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();

    // Fetch categories with their items and results
    const { data: categories, error: catError } = await adminClient
      .from("qa_categories")
      .select("*")
      .order("sort_order");

    if (catError) throw catError;

    const { data: items, error: itemsError } = await adminClient
      .from("qa_checklist_items")
      .select(`
        *,
        qa_test_results (*)
      `)
      .order("sort_order");

    if (itemsError) throw itemsError;

    // Group items by category
    const categorizedData = categories?.map(cat => ({
      ...cat,
      items: items?.filter(item => item.category_id === cat.id) || [],
    }));

    // Calculate stats
    const allResults = items?.flatMap((item: any) => item.qa_test_results) || [];
    const total = allResults.length;
    const pass = allResults.filter((r: any) => r.status === "pass").length;
    const fail = allResults.filter((r: any) => r.status === "fail").length;
    const pending = allResults.filter((r: any) => r.status === "pending").length;
    const blocked = allResults.filter((r: any) => r.status === "blocked").length;
    const tested = total - pending - blocked;
    const passRate = tested > 0 ? Math.round((pass / tested) * 100) : 0;
    
    const stats = { total, pass, fail, pending, blocked, passRate };

    // Category breakdown
    const categoryStats = categorizedData?.map(cat => {
      const catResults = cat.items.flatMap((item: any) => item.qa_test_results);
      const catTested = catResults.filter((r: any) => r.status !== "pending" && r.status !== "blocked").length;
      return {
        id: cat.id,
        name: cat.name,
        total: catResults.length,
        pass: catResults.filter((r: any) => r.status === "pass").length,
        fail: catResults.filter((r: any) => r.status === "fail").length,
        pending: catResults.filter((r: any) => r.status === "pending").length,
        passRate: catTested > 0 
          ? Math.round((catResults.filter((r: any) => r.status === "pass").length / catTested) * 100) 
          : 0,
      };
    });

    // Get critical/high priority failed items for launch blockers
    const launchBlockers = items
      ?.filter(item => {
        const result = item.qa_test_results[0];
        return (
          (item.priority === "critical" || item.priority === "high") &&
          result?.status === "fail"
        );
      })
      .map(item => ({
        ...item,
        result: item.qa_test_results[0],
      }));

    return NextResponse.json({
      categories: categorizedData,
      stats,
      categoryStats,
      launchBlockers,
    });
  } catch (error) {
    logger.error("QA fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch QA data" },
      { status: 500 }
    );
  }
}
