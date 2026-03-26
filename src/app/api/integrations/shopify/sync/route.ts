import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";
import {
  importProductsFromShopify,
  exportInventoryToShopify,
  importCustomersFromShopify,
  importOrdersFromShopify,
} from "@/lib/integrations/shopify/sync";

export async function POST(req: NextRequest) {
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
