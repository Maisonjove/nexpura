import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getUserLocationIds } from "@/lib/locations";
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
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant found" }, { status: 400 });
    }

    const body = await request.json();
    const { transferId } = body;

    if (!transferId) {
      return NextResponse.json({ error: "Transfer ID required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // ATOMIC STATUS GUARD: Update status first with conditional check
    // Only succeeds if status is still 'pending' — prevents double dispatch
    const { error: statusError, count: statusCount } = await admin
      .from("stock_transfers")
      .update({
        status: "in_transit",
        dispatched_at: new Date().toISOString(),
        dispatched_by: user.id,
      })
      .eq("id", transferId)
      .eq("tenant_id", userData.tenant_id)
      .eq("status", "pending"); // Only if still pending

    if (statusError) {
      logger.error("Dispatch status update error:", statusError);
      return NextResponse.json({ error: "Failed to dispatch transfer" }, { status: 500 });
    }

    if (statusCount === 0) {
      return NextResponse.json({ error: "Transfer already dispatched or not in pending status" }, { status: 400 });
    }

    // Now get transfer details (status is already updated, we own this dispatch)
    const { data: transfer, error: fetchError } = await admin
      .from("stock_transfers")
      .select("*, items:stock_transfer_items(*)")
      .eq("id", transferId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Verify user has access to source location
    const allowedIds = await getUserLocationIds(user.id, userData.tenant_id);
    if (allowedIds !== null && !allowedIds.includes(transfer.from_location_id)) {
      // Rollback status since user doesn't have permission
      await admin
        .from("stock_transfers")
        .update({ status: "pending", dispatched_at: null, dispatched_by: null })
        .eq("id", transferId);
      return NextResponse.json({ error: "You don't have access to dispatch from this location" }, { status: 403 });
    }

    // Deduct stock with conditional update + hard fail on insufficient
    for (const item of transfer.items) {
      const { data: currentItem } = await admin
        .from("inventory")
        .select("quantity")
        .eq("id", item.inventory_id)
        .eq("location_id", transfer.from_location_id)
        .single();
      
      if (!currentItem) continue;

      const oldQty = currentItem.quantity || 0;
      const newQty = oldQty - item.quantity;

      // HARD FAIL: Do not allow dispatch if insufficient stock
      if (newQty < 0) {
        // Rollback the status change
        await admin
          .from("stock_transfers")
          .update({ status: "pending", dispatched_at: null, dispatched_by: null })
          .eq("id", transferId);
        return NextResponse.json({ 
          error: `Insufficient stock for item. Available: ${oldQty}, Required: ${item.quantity}` 
        }, { status: 400 });
      }

      // Conditional update with retry
      const { count: updateCount } = await admin
        .from("inventory")
        .update({ quantity: newQty })
        .eq("id", item.inventory_id)
        .eq("location_id", transfer.from_location_id)
        .eq("quantity", oldQty);

      if (updateCount === 0) {
        // Race occurred — retry with fresh value
        const { data: retryItem } = await admin
          .from("inventory")
          .select("quantity")
          .eq("id", item.inventory_id)
          .eq("location_id", transfer.from_location_id)
          .single();

        if (!retryItem) continue;

        const retryOldQty = retryItem.quantity || 0;
        const retryNewQty = retryOldQty - item.quantity;

        if (retryNewQty < 0) {
          await admin
            .from("stock_transfers")
            .update({ status: "pending", dispatched_at: null, dispatched_by: null })
            .eq("id", transferId);
          return NextResponse.json({ 
            error: `Insufficient stock after recheck. Available: ${retryOldQty}, Required: ${item.quantity}` 
          }, { status: 400 });
        }

        await admin
          .from("inventory")
          .update({ quantity: retryNewQty })
          .eq("id", item.inventory_id)
          .eq("location_id", transfer.from_location_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Dispatch transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
