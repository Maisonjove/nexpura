"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { getAuthContext, requirePermission } from "@/lib/auth-context";

import { flushSentry } from "@/lib/sentry-flush";
interface ReceiveLine {
  inventoryId: string;
  receiveQty: number;
}

interface BatchReceiveParams {
  supplierId: string | null;
  invoiceRef: string | null;
  lines: ReceiveLine[];
}

export async function batchReceiveStock(
  params: BatchReceiveParams
): Promise<{ success?: boolean; error?: string }> {
  try {
    // RBAC: receiving stock is an inventory mutation; gate on edit_inventory
    // (Owner/Manager bypass per role matrix). Staff without the permission
    // can no longer batch-receive supplier shipments.
    try {
      await requirePermission("edit_inventory");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "You don't have permission to receive stock." : "Not authenticated" };
    }
    // SECURITY: Session-derive tenantId + userId. Previously (W3-CRIT-01)
    // this action took tenantId + userId from the request body, allowing
    // cross-tenant stock tampering + audit-log pollution.
    const ctx = await getAuthContext();
    if (!ctx) return { error: "Not authenticated" };
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;

    const admin = createAdminClient();

    if (!params.lines || params.lines.length === 0) return { error: "No items to receive" };

    let receivedCount = 0;

    for (const line of params.lines) {
      if (line.receiveQty <= 0) continue;

      // Three compounding bugs in the pre-fix shape:
      //   1. Direct UPDATE inventory.quantity then INSERT stock_movements
      //      collided with `sync_inventory_on_stock_movement_insert` BEFORE
      //      INSERT trigger → every receive applied 2× (receive 5 → +10).
      //   2. The UPDATE wrote `supplier_invoice_ref` which doesn't exist on
      //      `inventory` (verified 2026-04-25). PGRST204 → entire receive
      //      errored, but the next INSERT logged + log-and-continue silently
      //      ate the failure for the second-call retries pattern.
      //   3. Insert into `inventory_stock_movements` — that table doesn't
      //      exist at all. Logged-and-ignored, but pollutes error logs and
      //      represents dead intent.
      //
      // Fix: just emit the stock_movements row; the trigger handles the
      // inventory quantity + quantity_after.
      const { data: item } = await admin
        .from("inventory")
        .select("quantity")
        .eq("id", line.inventoryId)
        .eq("tenant_id", tenantId)
        .single();
      if (!item) continue;

      const { error: historyError } = await admin.from("stock_movements").insert({
        tenant_id: tenantId,
        inventory_id: line.inventoryId,
        movement_type: "purchase",
        quantity_change: line.receiveQty,
        notes: `Batch receive${params.invoiceRef ? ` - ${params.invoiceRef}` : ""}`,
        created_by: userId,
      });

      if (historyError) {
        logger.error(`[batchReceiveStock] Failed to log history for ${line.inventoryId}:`, historyError);
        continue;
      }

      receivedCount++;
    }

    // Log audit event for batch receive
    if (receivedCount > 0) {
      await logAuditEvent({
        tenantId,
        userId,
        action: "inventory_receive",
        entityType: "inventory",
        newData: {
          receivedCount,
          supplierId: params.supplierId,
          invoiceRef: params.invoiceRef,
          itemIds: params.lines.filter(l => l.receiveQty > 0).map(l => l.inventoryId),
        },
        metadata: { totalItems: params.lines.length },
      });
    }

    revalidatePath("/inventory");
    await flushSentry();
    return { success: true };
  } catch (err) {
    logger.error("[batchReceiveStock] Unexpected error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to receive stock" };
  }
}
