import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";
import {
  importProductsFromShopify,
  exportInventoryToShopify,
  importCustomersFromShopify,
  importOrdersFromShopify,
} from "@/lib/integrations/shopify/sync";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "heavy");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    const { direction = "import", type = "products" } = body;

    let result;
    if (direction === "import") {
      if (type === "products") result = await importProductsFromShopify(tenantId);
      else if (type === "customers") result = await importCustomersFromShopify(tenantId);
      else if (type === "orders") result = await importOrdersFromShopify(tenantId);
      else result = { success: false, errors: ["Unknown type"] };
    } else {
      result = await exportInventoryToShopify(tenantId);
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ success: false, errors: [err instanceof Error ? err.message : "Error"] }, { status: 500 });
  }
}
