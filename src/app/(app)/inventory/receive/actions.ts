"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth-context";

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

      // Get current quantity
      const { data: item, error: fetchError } = await admin
        .from("inventory")
        .select("quantity")
        .eq("id", line.inventoryId)
        .eq("tenant_id", tenantId)
        .single();

      if (fetchError) {
        logger.error(`[batchReceiveStock] Failed to fetch item ${line.inventoryId}:`, fetchError);
        continue;
      }

      if (!item) continue;

      const newQty = (item.quantity ?? 0) + line.receiveQty;

      // Update inventory
      const { error: updateError } = await admin
        .from("inventory")
        .update({
          quantity: newQty,
          supplier_invoice_ref: params.invoiceRef ?? undefined,
        })
        .eq("id", line.inventoryId)
        .eq("tenant_id", tenantId);

      if (updateError) {
        logger.error(`[batchReceiveStock] Failed to update item ${line.inventoryId}:`, updateError);
        continue;
      }

      // Log stock movement
      const { error: movementError } = await admin.from("inventory_stock_movements").insert({
        tenant_id: tenantId,
        inventory_item_id: line.inventoryId,
        moved_by: userId,
        from_location: null,
        to_location: "display",
        notes: `Received from supplier${params.invoiceRef ? ` (Inv: ${params.invoiceRef})` : ""}`,
      });

      if (movementError) {
        logger.error(`[batchReceiveStock] Failed to log movement for ${line.inventoryId}:`, movementError);
      }

      // Also log in stock_movements table (for stock history)
      const { error: historyError } = await admin.from("stock_movements").insert({
        tenant_id: tenantId,
        inventory_id: line.inventoryId,
        movement_type: "purchase",
        quantity_change: line.receiveQty,
        quantity_after: newQty,
        notes: `Batch receive${params.invoiceRef ? ` - ${params.invoiceRef}` : ""}`,
        created_by: userId,
      });

      if (historyError) {
        logger.error(`[batchReceiveStock] Failed to log history for ${line.inventoryId}:`, historyError);
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
    return { success: true };
  } catch (err) {
    logger.error("[batchReceiveStock] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to receive stock" };
  }
}
