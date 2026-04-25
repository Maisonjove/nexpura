"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, admin: createAdminClient(), userId: user.id, tenantId: userData.tenant_id };
}

export async function recordLaybyPayment(params: {
  saleId: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
  paymentDate: string;
}): Promise<{ success?: boolean; error?: string; newAmountPaid?: number; fullyPaid?: boolean }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, userId, tenantId } = ctx;

  // Verify sale belongs to tenant and is a layby
  const { data: sale } = await admin
    .from("sales")
    .select("id, total, amount_paid, status")
    .eq("id", params.saleId)
    .eq("tenant_id", tenantId)
    .single();

  if (!sale) return { error: "Sale not found" };
  if (sale.status !== "layby") return { error: "Sale is not a layby" };

  const currentPaid = sale.amount_paid ?? 0;
  const newPaid = currentPaid + params.amount;

  if (params.amount <= 0) return { error: "Payment amount must be greater than 0" };
  if (newPaid > sale.total) return { error: `Payment exceeds outstanding balance of ${(sale.total - currentPaid).toFixed(2)}` };

  // Insert layby payment
  const { error: paymentErr } = await admin.from("layby_payments").insert({
    tenant_id: tenantId,
    sale_id: params.saleId,
    amount: params.amount,
    payment_method: params.paymentMethod,
    notes: params.notes || null,
    paid_by: userId,
    paid_at: params.paymentDate,
  });

  if (paymentErr) return { error: paymentErr.message };

  // Update amount_paid on sale
  const updatePayload: Record<string, unknown> = { amount_paid: newPaid };

  // If fully paid, mark as paid
  const isFullyPaid = newPaid >= sale.total;
  if (isFullyPaid) {
    updatePayload.status = "paid";
    updatePayload.payment_method = params.paymentMethod;
  }

  await admin
    .from("sales")
    .update(updatePayload)
    .eq("id", params.saleId)
    .eq("tenant_id", tenantId);

  // Deduct inventory when layby is fully paid
  if (isFullyPaid) {
    const { data: saleItems } = await admin
      .from("sale_items")
      .select("inventory_id, quantity")
      .eq("sale_id", params.saleId)
      .not("inventory_id", "is", null);

    if (saleItems) {
      for (const item of saleItems) {
        if (!item.inventory_id) continue;
        const { data: inv } = await admin
          .from("inventory")
          .select("quantity")
          .eq("id", item.inventory_id)
          .eq("tenant_id", tenantId)
          .single();

        if (inv) {
          const newQty = Math.max(0, inv.quantity - item.quantity);
          await admin
            .from("inventory")
            .update({ quantity: newQty })
            .eq("id", item.inventory_id)
            .eq("tenant_id", tenantId);

          await admin.from("stock_movements").insert({
            tenant_id: tenantId,
            inventory_id: item.inventory_id,
            movement_type: "sale",
            quantity_change: -item.quantity,
            quantity_after: newQty,
            notes: `Layby sale ${params.saleId} — fully paid`,
            created_by: userId,
          });
        }
      }
    }
  }

  revalidatePath(`/sales/${params.saleId}`);
  revalidatePath("/sales");
  return { success: true, newAmountPaid: newPaid, fullyPaid: isFullyPaid };
}

export async function getLaybyPayments(saleId: string) {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { data: null, error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;

  const { data, error } = await admin
    .from("layby_payments")
    .select("*")
    .eq("sale_id", saleId)
    .eq("tenant_id", tenantId)
    .order("paid_at", { ascending: false });

  return { data, error: error?.message ?? null };
}
