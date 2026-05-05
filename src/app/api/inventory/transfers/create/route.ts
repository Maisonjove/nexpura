import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getUserLocationIds } from "@/lib/locations";
import { requirePermission } from "@/lib/auth-context";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (request: NextRequest) => {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // RBAC: stock transfers move money-equivalent inventory between
    // locations; gate on edit_inventory so Staff (read-only) can't ship
    // a tenant's stock around.
    try {
      await requirePermission("edit_inventory");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return NextResponse.json(
        { error: msg.startsWith("permission_denied") ? "You don't have permission to create transfers." : "Not authenticated" },
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
    const { fromLocationId, toLocationId, notes, items } = body;

    if (!fromLocationId || !toLocationId || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (fromLocationId === toLocationId) {
      return NextResponse.json({ error: "Source and destination cannot be the same" }, { status: 400 });
    }

    // Verify user has access to source location.
    // Canonical contract: NULL = all access (owner/manager); populated array
    // = restricted subset; matches LocationContext.tsx:69 + TransfersClient.tsx:126.
    const allowedIds = await getUserLocationIds(user.id, userData.tenant_id);
    if (allowedIds !== null && !allowedIds.includes(fromLocationId)) {
      // QA audit C-04 (2026-05-05): emit telemetry on every transfer denial
      // so we can spot location-access regressions in Sentry rather than
      // waiting for another QA pass.
      logger.error("[inventory/transfers/create] location access denied", {
        tenant_id: userData.tenant_id,
        user_id: user.id,
        route: "/api/inventory/transfers/create",
        from_location_id: fromLocationId,
        allowed_location_ids: allowedIds,
      });
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
      // Kind C (best-effort observability log+continue). Saga
      // compensating rollback: items insert failed, delete the orphan
      // transfer header. If the rollback itself fails, the row stays
      // as an item-less transfer — log loudly so ops can manually
      // delete; we still return 500 below so the caller knows the
      // transfer didn't go through.
      const { error: rollbackErr } = await admin.from("stock_transfers").delete().eq("id", transfer.id);
      if (rollbackErr) {
        logger.error("[inventory/transfers/create] rollback of orphan transfer failed; manual cleanup needed", {
          transferId: transfer.id,
          itemsError: itemsError.message,
          rollbackErr,
        });
      }
      return NextResponse.json({ error: "Failed to create transfer items" }, { status: 500 });
    }

    return NextResponse.json({ success: true, transferId: transfer.id });
  } catch (error) {
    logger.error("Create transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
