import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findSaleQuerySchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const parseResult = findSaleQuerySchema.safeParse({
    q: searchParams.get("q"),
    tenantId: searchParams.get("tenantId"),
  });
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }
  const { q, tenantId } = parseResult.data;

  const admin = createAdminClient();

  // Search by sale_number or customer name
  const { data: sale, error } = await admin
    .from("sales")
    .select("id, sale_number, total, payment_method, created_at, customer_name, sale_items(id, inventory_id, quantity, unit_price, total, inventory(name))")
    .eq("tenant_id", tenantId)
    .or(`sale_number.ilike.%${q}%,customer_name.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  // Format items
  const items = (sale.sale_items || []).map((item: any) => ({
    id: item.id,
    inventory_name: (Array.isArray(item.inventory) ? item.inventory[0]?.name : item.inventory?.name) || "Item",
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total,
  }));

  return NextResponse.json({
    sale: {
      id: sale.id,
      sale_number: sale.sale_number,
      total: sale.total,
      payment_method: sale.payment_method,
      created_at: sale.created_at,
      customer_name: sale.customer_name,
      items,
    }
  });
}
