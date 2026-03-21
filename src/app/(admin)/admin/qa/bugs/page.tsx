import { createAdminClient } from "@/lib/supabase/admin";
import BugListClient from "./BugListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BugListPage() {
  let bugs: any[] = [];

  try {
    const adminClient = createAdminClient();

    // Get all items with their results
    const { data: items } = await adminClient
      .from("qa_checklist_items")
      .select(`
        *,
        qa_categories (name, icon),
        qa_test_results (*)
      `)
      .order("priority")
      .order("sort_order");

    // Filter to only failed items
    bugs = (items || [])
      .filter(item => item.qa_test_results?.[0]?.status === "fail")
      .map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.qa_categories?.name || "Unknown",
        categoryIcon: item.qa_categories?.icon,
        priority: item.priority,
        route: item.route,
        testingGuidance: item.testing_guidance,
        notes: item.qa_test_results?.[0]?.notes,
        screenshotUrl: item.qa_test_results?.[0]?.screenshot_url,
        testerName: item.qa_test_results?.[0]?.tester_name,
        testedAt: item.qa_test_results?.[0]?.tested_at,
      }));
  } catch (error) {
    console.error("Failed to fetch bugs:", error);
  }

  // Group by priority
  const byPriority = {
    critical: bugs.filter(b => b.priority === "critical"),
    high: bugs.filter(b => b.priority === "high"),
    medium: bugs.filter(b => b.priority === "medium"),
    low: bugs.filter(b => b.priority === "low"),
  };

  return <BugListClient bugs={bugs} byPriority={byPriority} />;
}
