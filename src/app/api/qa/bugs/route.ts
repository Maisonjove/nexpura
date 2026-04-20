import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";


// GET /api/qa/bugs - Get all failed items as bug list
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

    // Get all items with failed status
    const { data: items, error } = await adminClient
      .from("qa_checklist_items")
      .select(`
        *,
        qa_categories!inner (name, icon),
        qa_test_results!inner (*)
      `)
      .order("priority")
      .order("sort_order");

    if (error) throw error;

    // Filter to only failed items
    const bugs = items
      ?.filter(item => item.qa_test_results[0]?.status === "fail")
      .map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.qa_categories.name,
        categoryIcon: item.qa_categories.icon,
        priority: item.priority,
        route: item.route,
        testingGuidance: item.testing_guidance,
        notes: item.qa_test_results[0]?.notes,
        screenshotUrl: item.qa_test_results[0]?.screenshot_url,
        testerName: item.qa_test_results[0]?.tester_name,
        testedAt: item.qa_test_results[0]?.tested_at,
      }));

    // Group by priority
    const critical = bugs?.filter(b => b.priority === "critical") || [];
    const high = bugs?.filter(b => b.priority === "high") || [];
    const medium = bugs?.filter(b => b.priority === "medium") || [];
    const low = bugs?.filter(b => b.priority === "low") || [];

    return NextResponse.json({
      total: bugs?.length || 0,
      bugs,
      byPriority: {
        critical,
        high,
        medium,
        low,
      },
    });
  } catch (error) {
    logger.error("QA bugs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bug list" },
      { status: 500 }
    );
  }
}
