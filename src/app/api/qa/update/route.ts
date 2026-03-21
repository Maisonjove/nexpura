import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/qa/update - Update a test result
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      checklistItemId, 
      status, 
      notes, 
      screenshotUrl, 
      testerName, 
      testerEmail 
    } = body;

    if (!checklistItemId) {
      return NextResponse.json(
        { error: "checklistItemId is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check if result exists
    const { data: existing } = await adminClient
      .from("qa_test_results")
      .select("id")
      .eq("checklist_item_id", checklistItemId)
      .single();

    const updateData = {
      status: status || "pending",
      notes: notes || null,
      screenshot_url: screenshotUrl || null,
      tester_name: testerName || null,
      tester_email: testerEmail || null,
      tested_at: status && status !== "pending" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await adminClient
        .from("qa_test_results")
        .update(updateData)
        .eq("checklist_item_id", checklistItemId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await adminClient
        .from("qa_test_results")
        .insert({
          checklist_item_id: checklistItemId,
          ...updateData,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("QA update error:", error);
    return NextResponse.json(
      { error: "Failed to update test result" },
      { status: 500 }
    );
  }
}

// POST /api/qa/update/bulk - Bulk update test results
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const results = [];

    for (const update of updates) {
      const { checklistItemId, status, notes, testerName } = update;
      
      const { data, error } = await adminClient
        .from("qa_test_results")
        .update({
          status,
          notes: notes || null,
          tester_name: testerName || null,
          tested_at: status !== "pending" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("checklist_item_id", checklistItemId)
        .select()
        .single();

      if (!error) results.push(data);
    }

    return NextResponse.json({ success: true, updated: results.length });
  } catch (error) {
    console.error("QA bulk update error:", error);
    return NextResponse.json(
      { error: "Failed to bulk update test results" },
      { status: 500 }
    );
  }
}
