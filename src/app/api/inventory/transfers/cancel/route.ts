import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant found" }, { status: 400 });
    }

    // Only owners and managers can cancel transfers
    if (userData.role !== "owner" && userData.role !== "manager") {
      return NextResponse.json({ error: "Only managers can cancel transfers" }, { status: 403 });
    }

    const body = await request.json();
    const { transferId } = body;

    if (!transferId) {
      return NextResponse.json({ error: "Transfer ID required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get the transfer
    const { data: transfer, error: fetchError } = await admin
      .from("stock_transfers")
      .select("*, items:stock_transfer_items(*)")
      .eq("id", transferId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (transfer.status === "completed" || transfer.status === "cancelled") {
      return NextResponse.json({ error: "Cannot cancel a completed or already cancelled transfer" }, { status: 400 });
    }

    // If transfer was in_transit, restore stock to source location.
    // Pre-fix this read-then-wrote inventory.quantity directly with no
    // CAS and no stock_movements row — concurrent POS sale during a
    // cancel could lose the increment, plus the restore was invisible
    // to audit history. Now: emit a 'transfer_cancel' movement; the
    // BEFORE INSERT trigger handles the qty bump race-safely.
    if (transfer.status === "in_transit") {
      for (const item of transfer.items) {
        const { error: movErr } = await admin.from("stock_movements").insert({
          tenant_id: userData.tenant_id,
          inventory_id: item.inventory_id,
          movement_type: "transfer_cancel",
          quantity_change: item.quantity,
          notes: `Transfer ${transferId} cancelled — stock restored`,
          created_by: user.id,
        });
        if (movErr) {
          logger.error("Cancel restore stock_movement failed:", movErr);
        }
      }
    }

    // Update transfer status to cancelled (scope to tenant_id for
    // defence-in-depth even though we already filtered above).
    const { error: updateError } = await admin
      .from("stock_transfers")
      .update({ status: "cancelled" })
      .eq("id", transferId)
      .eq("tenant_id", userData.tenant_id);

    if (updateError) {
      logger.error("Cancel update error:", updateError);
      return NextResponse.json({ error: "Failed to cancel transfer" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Cancel transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
