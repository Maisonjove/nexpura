"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

interface ReceiveLine {
  inventoryId: string;
  receiveQty: number;
}

interface BatchReceiveParams {
  tenantId: string;
  userId: string;
  supplierId: string | null;
  invoiceRef: string | null;
  lines: ReceiveLine[];
}

export async function batchReceiveStock(
  params: BatchReceiveParams
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  for (const line of params.lines) {
    if (line.receiveQty <= 0) continue;

    // Get current quantity
    const { data: item } = await admin
      .from("inventory")
      .select("quantity")
      .eq("id", line.inventoryId)
      .eq("tenant_id", params.tenantId)
      .single();

    if (!item) continue;

    const newQty = (item.quantity ?? 0) + line.receiveQty;

    // Update inventory
    await admin
      .from("inventory")
      .update({
        quantity: newQty,
        supplier_invoice_ref: params.invoiceRef ?? undefined,
      })
      .eq("id", line.inventoryId)
      .eq("tenant_id", params.tenantId);

    // Log stock movement
    await admin.from("inventory_stock_movements").insert({
      tenant_id: params.tenantId,
      inventory_item_id: line.inventoryId,
      moved_by: params.userId,
      from_location: null,
      to_location: "display",
      notes: `Received from supplier${params.invoiceRef ? ` (Inv: ${params.invoiceRef})` : ""}`,
    });

    // Also log in stock_movements table (for stock history)
    await admin.from("stock_movements").insert({
      tenant_id: params.tenantId,
      inventory_id: line.inventoryId,
      movement_type: "purchase",
      quantity_change: line.receiveQty,
      quantity_after: newQty,
      notes: `Batch receive${params.invoiceRef ? ` - ${params.invoiceRef}` : ""}`,
      created_by: params.userId,
    });
  }

  revalidatePath("/inventory");
  return { success: true };
}
