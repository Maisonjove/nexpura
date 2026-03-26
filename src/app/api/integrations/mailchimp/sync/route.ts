import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";
import { syncToMailchimp } from "@/lib/integrations/mailchimp";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "heavy");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const result = await syncToMailchimp(tenantId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ success: false, errors: [err instanceof Error ? err.message : "Error"] }, { status: 500 });
  }
}
