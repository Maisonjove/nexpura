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
    const { transferId, items } = body;

    if (!transferId) {
      return NextResponse.json({ error: "Transfer ID required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // ATOMIC STATUS GUARD: prevent double-receive. count: "exact"
    // is required for the statusCount check below (PostgREST returns
    // null without it).
    const { error: statusError, count: statusCount } = await admin
      .from("stock_transfers")
      .update(
        {
          status: "completed",
          received_at: new Date().toISOString(),
          received_by: user.id,
        },
        { count: "exact" },
      )
      .eq("id", transferId)
      .eq("tenant_id", userData.tenant_id)
      .eq("status", "in_transit"); // Only if still in_transit

    if (statusError) {
      logger.error("Receive status update error:", statusError);
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

    // Process each item.
    //
    // Pre-fix the no-existing-row branch overwrote the source row's
    // location_id + quantity with `receivedQty` — that wholesale lost
    // any remaining stock at the source (e.g. dispatch transferred 3
    // of 10, source row at 7; receive then "moved" the source row to
    // dest with quantity=3 → 4 units vanished + source location went
    // empty).
    //
    // Now: emit a 'transfer_in' stock_movement against the destination
    // inventory row (creating a new row at the dest location if one
    // doesn't already exist for that SKU). The BEFORE INSERT trigger
    // sync_inventory_on_stock_movement_insert handles the qty update
    // race-safely. Source row keeps whatever quantity dispatch left it
    // with — no destruction.
    for (const transferItem of transfer.transfer_items) {
      const itemUpdate = items?.find((i: { itemId: string; receivedQty: number }) => i.itemId === transferItem.id);
      const receivedQty = itemUpdate?.receivedQty ?? transferItem.quantity;

      await admin
        .from("stock_transfer_items")
        .update({ received_quantity: receivedQty })
        .eq("id", transferItem.id);

      const sourceRow = transferItem.inventory as { id: string; sku?: string; name?: string; jewellery_type?: string; retail_price?: number; cost_price?: number } | null;

      // Find or create the destination inventory row.
      let destRowId: string | null = null;
      if (sourceRow?.sku) {
        const { data: existing } = await admin
          .from("inventory")
          .select("id")
          .eq("tenant_id", userData.tenant_id)
          .eq("sku", sourceRow.sku)
          .eq("location_id", transfer.to_location_id)
          .maybeSingle();
        destRowId = (existing?.id as string | undefined) ?? null;
      }

      if (!destRowId) {
        // Create a fresh inventory row at the destination location with
        // quantity=0; the trigger will bump it to receivedQty when the
        // movement inserts.
        const { data: created, error: createErr } = await admin
          .from("inventory")
          .insert({
            tenant_id: userData.tenant_id,
            location_id: transfer.to_location_id,
            sku: sourceRow?.sku ?? null,
            name: sourceRow?.name ?? "Transferred Item",
            jewellery_type: sourceRow?.jewellery_type ?? null,
            retail_price: sourceRow?.retail_price ?? 0,
            cost_price: sourceRow?.cost_price ?? null,
            quantity: 0,
            status: "active",
            created_by: user.id,
          })
          .select("id")
          .single();
        if (createErr || !created) {
          logger.error("Receive create dest inventory failed:", createErr);
          continue;
        }
        destRowId = created.id;
      }

      const { error: movErr } = await admin.from("stock_movements").insert({
        tenant_id: userData.tenant_id,
        inventory_id: destRowId,
        movement_type: "transfer_in",
        quantity_change: receivedQty,
        notes: `Transfer ${transferId} received from ${transfer.from_location_id}`,
        created_by: user.id,
      });
      if (movErr) {
        logger.error("Receive stock_movement insert failed:", movErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Receive transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
