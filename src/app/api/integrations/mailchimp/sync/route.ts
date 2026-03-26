import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";
import { syncToMailchimp } from "@/lib/integrations/mailchimp";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const result = await syncToMailchimp(tenantId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ success: false, errors: [err instanceof Error ? err.message : "Error"] }, { status: 500 });
  }
}
