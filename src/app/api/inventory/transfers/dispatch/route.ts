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

    if (transfer.status !== "pending") {
      return NextResponse.json({ error: "Transfer is not in pending status" }, { status: 400 });
    }

    // Verify user has access to source location
    const allowedIds = await getUserLocationIds(user.id, userData.tenant_id);
    if (allowedIds !== null && !allowedIds.includes(transfer.from_location_id)) {
      return NextResponse.json({ error: "You don't have access to dispatch from this location" }, { status: 403 });
    }

    // Reserve/deduct stock from source location
    for (const item of transfer.items) {
      // Get current quantity first
      const { data: currentItem } = await admin
        .from("inventory")
        .select("quantity")
        .eq("id", item.inventory_id)
        .single();
      
      if (currentItem) {
        const newQuantity = Math.max(0, (currentItem.quantity || 0) - item.quantity);
        await admin
          .from("inventory")
          .update({ quantity: newQuantity })
          .eq("id", item.inventory_id)
          .eq("location_id", transfer.from_location_id);
      }
    }

    // Update transfer status to in_transit
    const { error: updateError } = await admin
      .from("stock_transfers")
      .update({
        status: "in_transit",
        dispatched_at: new Date().toISOString(),
        dispatched_by: user.id,
      })
      .eq("id", transferId);

    if (updateError) {
      console.error("Dispatch update error:", updateError);
      return NextResponse.json({ error: "Failed to dispatch transfer" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Dispatch transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
