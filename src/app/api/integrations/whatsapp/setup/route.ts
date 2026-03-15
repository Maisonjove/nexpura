/**
 * POST /api/integrations/whatsapp/setup
 *
 * Saves WhatsApp Business Cloud API credentials to the integrations table.
 *
 * Body: { business_account_id, phone_number_id, access_token }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, upsertIntegration } from "@/lib/integrations";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    const { business_account_id, phone_number_id, access_token } = body;

    if (!business_account_id || !phone_number_id || !access_token) {
      return NextResponse.json(
        { error: "business_account_id, phone_number_id, and access_token are required" },
        { status: 400 }
      );
    }

    const { error } = await upsertIntegration(tenantId, "whatsapp", {
      business_account_id,
      phone_number_id,
      access_token,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[whatsapp/setup]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * GET /api/integrations/whatsapp/setup
 * Returns current WhatsApp config (without access_token).
 */
export async function GET(_req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const { getIntegration } = await import("@/lib/integrations");
    const integration = await getIntegration(tenantId, "whatsapp");

    if (!integration) {
      return NextResponse.json({ connected: false });
    }

    const cfg = integration.config as Record<string, unknown>;
    return NextResponse.json({
      connected: integration.status === "connected",
      business_account_id: cfg.business_account_id ?? null,
      phone_number_id: cfg.phone_number_id ?? null,
      // Never return the token to the client
      has_token: !!cfg.access_token,
      status: integration.status,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
