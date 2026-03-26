import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";
import { runFullWooSync } from "@/lib/integrations/woocommerce/sync";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const result = await runFullWooSync(tenantId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
