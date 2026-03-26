/**
 * POST /api/integrations/whatsapp/send
 *
 * Sends a WhatsApp message via the Meta Business Cloud API.
 *
 * Body: { to: string, message: string }
 *
 * Requires WhatsApp integration to be connected for the tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();

    // Rate limit WhatsApp sends per tenant to prevent spam
    const { success } = await checkRateLimit(`whatsapp-send:${tenantId}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    const body = await req.json();
    const { to, message } = body as { to: string; message: string };

    if (!to || !message) {
      return NextResponse.json({ error: "to and message are required" }, { status: 400 });
    }

    const integration = await getIntegration(tenantId, "whatsapp");
    if (!integration || integration.status !== "connected") {
      return NextResponse.json({ error: "WhatsApp is not connected" }, { status: 400 });
    }

    const cfg = integration.config as Record<string, unknown>;
    const phoneNumberId = cfg.phone_number_id as string;
    const accessToken = cfg.access_token as string;

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: "WhatsApp credentials are incomplete" },
        { status: 400 }
      );
    }

    // Normalise phone number: strip non-digits, ensure no leading +
    const normalised = to.replace(/\D/g, "");

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalised,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData as any)?.error?.message ?? `HTTP ${res.status}`;
      logger.error("[whatsapp/send] API error:", msg);
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, message_id: (data as any)?.messages?.[0]?.id });
  } catch (err) {
    logger.error("[whatsapp/send]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
