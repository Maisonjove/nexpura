import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getUserLocationIds } from "@/lib/locations";
import { requirePermission } from "@/lib/auth-context";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    try {
      await requirePermission("edit_inventory");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return NextResponse.json(
        { error: msg.startsWith("permission_denied") ? "You don't have permission to manage transfers." : "Not authenticated" },
        { status: 403 },
      );
    }
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

    // ATOMIC STATUS GUARD: Update status first with conditional check.
    // count: "exact" required — without it PostgREST returns count=null
    // and the `=== 0` guard below never trips (same bug fixed in
    // batch-5 across the CAS sites).
    const { error: statusError, count: statusCount } = await admin
      .from("stock_transfers")
      .update(
        {
          status: "in_transit",
          dispatched_at: new Date().toISOString(),
          dispatched_by: user.id,
        },
        { count: "exact" },
      )
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

    // Deduct stock at the source location. Pre-fix this UPDATEd
    // inventory.quantity directly with no stock_movements row → no
    // audit trail (item-level history showed only the bare quantity
    // change with no reason). Now: pre-flight check for friendly
    // error UX, then emit a 'transfer_out' stock_movement and let
    // the BEFORE INSERT trigger sync_inventory_on_stock_movement_insert
    // do the actual quantity change. Race-safety stays because the
    // trigger reads-and-adds in a single statement.
    for (const item of transfer.items) {
      const { data: currentItem } = await admin
        .from("inventory")
        .select("quantity")
        .eq("id", item.inventory_id)
        .eq("location_id", transfer.from_location_id)
        .eq("tenant_id", userData.tenant_id)
        .single();

      if (!currentItem) continue;

      const available = currentItem.quantity || 0;
      if (available - item.quantity < 0) {
        // Rollback the status change
        await admin
          .from("stock_transfers")
          .update({ status: "pending", dispatched_at: null, dispatched_by: null })
          .eq("id", transferId);
        return NextResponse.json({
          error: `Insufficient stock for item. Available: ${available}, Required: ${item.quantity}`,
        }, { status: 400 });
      }

      const { error: movErr } = await admin.from("stock_movements").insert({
        tenant_id: userData.tenant_id,
        inventory_id: item.inventory_id,
        movement_type: "transfer_out",
        quantity_change: -item.quantity,
        notes: `Transfer ${transferId} dispatched`,
        created_by: user.id,
      });
      if (movErr) {
        logger.error("Dispatch stock_movement insert failed:", movErr);
        await admin
          .from("stock_transfers")
          .update({ status: "pending", dispatched_at: null, dispatched_by: null })
          .eq("id", transferId);
        return NextResponse.json({ error: "Failed to dispatch — please retry." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Dispatch transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
