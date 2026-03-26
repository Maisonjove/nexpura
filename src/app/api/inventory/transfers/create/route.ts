import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getUserLocationIds } from "@/lib/locations";
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
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant found" }, { status: 400 });
    }

    const body = await request.json();
    const { fromLocationId, toLocationId, notes, items } = body;

    if (!fromLocationId || !toLocationId || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (fromLocationId === toLocationId) {
      return NextResponse.json({ error: "Source and destination cannot be the same" }, { status: 400 });
    }

    // Verify user has access to source location
    const allowedIds = await getUserLocationIds(user.id, userData.tenant_id);
    if (allowedIds !== null && !allowedIds.includes(fromLocationId)) {
      return NextResponse.json({ error: "You don't have access to the source location" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Create the transfer
    const { data: transfer, error: transferError } = await admin
      .from("stock_transfers")
      .insert({
        tenant_id: userData.tenant_id,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        status: "pending",
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (transferError || !transfer) {
      logger.error("Transfer creation error:", transferError);
      return NextResponse.json({ error: "Failed to create transfer" }, { status: 500 });
    }

    // Create transfer items
    const transferItems = items.map((item: { inventoryId: string; quantity: number }) => ({
      transfer_id: transfer.id,
      inventory_id: item.inventoryId,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await admin
      .from("stock_transfer_items")
      .insert(transferItems);

    if (itemsError) {
      logger.error("Transfer items creation error:", itemsError);
      // Rollback - delete the transfer
      await admin.from("stock_transfers").delete().eq("id", transfer.id);
      return NextResponse.json({ error: "Failed to create transfer items" }, { status: 500 });
    }

    return NextResponse.json({ success: true, transferId: transfer.id });
  } catch (error) {
    logger.error("Create transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
