import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";
import { connectMailchimp } from "@/lib/integrations/mailchimp";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const { api_key, list_id, auto_sync } = await req.json();
    if (!api_key || !list_id) return NextResponse.json({ error: "API key and list ID required" }, { status: 400 });

    const result = await connectMailchimp(tenantId, api_key, list_id, auto_sync ?? true);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
