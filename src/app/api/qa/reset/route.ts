import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";


// POST /api/qa/reset - Reset all or category test results
export async function POST(request: NextRequest) {
  // Rate limiting - heavy operation
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const { success } = await checkRateLimit(ip, "heavy");
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
    const body = await request.json();
    const { categoryId } = body;

    const adminClient = createAdminClient();

    if (categoryId) {
      // Reset only items in specific category
      const { data: items } = await adminClient
        .from("qa_checklist_items")
        .select("id")
        .eq("category_id", categoryId);

      if (items && items.length > 0) {
        const itemIds = items.map(i => i.id);
        
        const { error } = await adminClient
          .from("qa_test_results")
          .update({
            status: "pending",
            notes: null,
            screenshot_url: null,
            tester_name: null,
            tester_email: null,
            tested_at: null,
            updated_at: new Date().toISOString(),
          })
          .in("checklist_item_id", itemIds);

        if (error) throw error;
      }
    } else {
      // Reset all
      const { error } = await adminClient
        .from("qa_test_results")
        .update({
          status: "pending",
          notes: null,
          screenshot_url: null,
          tester_name: null,
          tester_email: null,
          tested_at: null,
          updated_at: new Date().toISOString(),
        })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Match all

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("QA reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset test results" },
      { status: 500 }
    );
  }
}
