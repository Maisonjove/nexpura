/**
 * POST /api/integrations/whatsapp/test
 *
 * Tests the WhatsApp Business API connection by calling
 * GET https://graph.facebook.com/v18.0/{phone_number_id}
 *
 * Returns { success, phone_number, display_name } on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(_req: NextRequest) {
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    const integration = await getIntegration(tenantId, "whatsapp");

    if (!integration) {
      return NextResponse.json({ error: "WhatsApp is not configured" }, { status: 400 });
    }

    const cfg = integration.config as Record<string, unknown>;
    const phoneNumberId = cfg.phone_number_id as string;
    const accessToken = cfg.access_token as string;

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: "Missing phone_number_id or access_token" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData as any)?.error?.message ?? `HTTP ${res.status}`;

      // Mark as error
      await upsertIntegration(tenantId, "whatsapp", cfg, "error");
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const data: any = await res.json();

    // Mark as connected
    await upsertIntegration(tenantId, "whatsapp", cfg, "connected");

    return NextResponse.json({
      success: true,
      display_phone_number: data.display_phone_number ?? null,
      verified_name: data.verified_name ?? null,
    });
  } catch (err) {
    logger.error("[whatsapp/test]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
