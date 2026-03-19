import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getUserLocationIds } from "@/lib/locations";

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
    const { transferId, items } = body;

    if (!transferId) {
      return NextResponse.json({ error: "Transfer ID required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // ATOMIC STATUS GUARD: Update status first with conditional check
    // Only succeeds if status is still 'in_transit' — prevents double receive
    const { error: statusError, count: statusCount } = await admin
      .from("stock_transfers")
      .update({
        status: "completed",
        received_at: new Date().toISOString(),
        received_by: user.id,
      })
      .eq("id", transferId)
      .eq("tenant_id", userData.tenant_id)
      .eq("status", "in_transit"); // Only if still in_transit

    if (statusError) {
      console.error("Receive status update error:", statusError);
      return NextResponse.json({ error: "Failed to complete transfer" }, { status: 500 });
    }

    if (statusCount === 0) {
      return NextResponse.json({ error: "Transfer already received or not in transit" }, { status: 400 });
    }

    // Now get transfer details (status is already updated, we own this receive)
    const { data: transfer, error: fetchError } = await admin
      .from("stock_transfers")
      .select("*, transfer_items:stock_transfer_items(*, inventory:inventory_id(*))")
      .eq("id", transferId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Verify user has access to destination location
    const allowedIds = await getUserLocationIds(user.id, userData.tenant_id);
    if (allowedIds !== null && !allowedIds.includes(transfer.to_location_id)) {
      // Rollback status since user doesn't have permission
      await admin
        .from("stock_transfers")
        .update({ status: "in_transit", received_at: null, received_by: null })
        .eq("id", transferId);
      return NextResponse.json({ error: "You don't have access to receive at this location" }, { status: 403 });
    }

    // Process each item with conditional updates
    for (const transferItem of transfer.transfer_items) {
      const itemUpdate = items?.find((i: { itemId: string; receivedQty: number }) => i.itemId === transferItem.id);
      const receivedQty = itemUpdate?.receivedQty ?? transferItem.quantity;

      // Update transfer item with received quantity
      await admin
        .from("stock_transfer_items")
        .update({ received_quantity: receivedQty })
        .eq("id", transferItem.id);

      // Check if inventory item already exists at destination
      const { data: existingItem } = await admin
        .from("inventory")
        .select("id, quantity")
        .eq("tenant_id", userData.tenant_id)
        .eq("sku", transferItem.inventory?.sku)
        .eq("location_id", transfer.to_location_id)
        .maybeSingle();

      if (existingItem) {
        // Conditional update for existing item at destination
        const oldQty = existingItem.quantity || 0;
        const newQty = oldQty + receivedQty;

        const { count: updateCount } = await admin
          .from("inventory")
          .update({ quantity: newQty })
          .eq("id", existingItem.id)
          .eq("quantity", oldQty);

        if (updateCount === 0) {
          // Race — retry with fresh value
          const { data: retryItem } = await admin
            .from("inventory")
            .select("quantity")
            .eq("id", existingItem.id)
            .single();

          if (retryItem) {
            await admin
              .from("inventory")
              .update({ quantity: (retryItem.quantity || 0) + receivedQty })
              .eq("id", existingItem.id);
          }
        }
      } else {
        // Move item to destination location
        await admin
          .from("inventory")
          .update({ 
            location_id: transfer.to_location_id,
            quantity: receivedQty 
          })
          .eq("id", transferItem.inventory_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Receive transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
