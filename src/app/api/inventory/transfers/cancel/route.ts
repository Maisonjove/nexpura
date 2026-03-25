import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function POST(request: Request) {
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

    // If transfer was in_transit, restore stock to source location
    if (transfer.status === "in_transit") {
      for (const item of transfer.items) {
        // Restore quantity to source location
        const { data: sourceItem } = await admin
          .from("inventory")
          .select("quantity")
          .eq("id", item.inventory_id)
          .single();

        if (sourceItem) {
          await admin
            .from("inventory")
            .update({ quantity: (sourceItem.quantity || 0) + item.quantity })
            .eq("id", item.inventory_id);
        }
      }
    }

    // Update transfer status to cancelled
    const { error: updateError } = await admin
      .from("stock_transfers")
      .update({ status: "cancelled" })
      .eq("id", transferId);

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
