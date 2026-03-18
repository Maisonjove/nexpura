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

    // Get the transfer
    const { data: transfer, error: fetchError } = await admin
      .from("stock_transfers")
      .select("*, transfer_items:stock_transfer_items(*, inventory:inventory_id(*))")
      .eq("id", transferId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    if (transfer.status !== "in_transit") {
      return NextResponse.json({ error: "Transfer is not in transit" }, { status: 400 });
    }

    // Verify user has access to destination location
    const allowedIds = await getUserLocationIds(user.id, userData.tenant_id);
    if (allowedIds !== null && !allowedIds.includes(transfer.to_location_id)) {
      return NextResponse.json({ error: "You don't have access to receive at this location" }, { status: 403 });
    }

    // Process each item - update received quantities and move stock
    for (const transferItem of transfer.transfer_items) {
      // Find received quantity from request (defaults to full quantity)
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
        // Update existing inventory quantity at destination
        await admin
          .from("inventory")
          .update({ quantity: existingItem.quantity + receivedQty })
          .eq("id", existingItem.id);
      } else {
        // Update the inventory item's location (simple move)
        // For unique items, just change the location
        await admin
          .from("inventory")
          .update({ 
            location_id: transfer.to_location_id,
            quantity: receivedQty 
          })
          .eq("id", transferItem.inventory_id);
      }
    }

    // Update transfer status to completed
    const { error: updateError } = await admin
      .from("stock_transfers")
      .update({
        status: "completed",
        received_at: new Date().toISOString(),
        received_by: user.id,
      })
      .eq("id", transferId);

    if (updateError) {
      console.error("Receive update error:", updateError);
      return NextResponse.json({ error: "Failed to complete transfer" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Receive transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
