/**
 * POST /api/notifications/whatsapp
 *
 * Send a WhatsApp notification via Twilio
 *
 * Body: { to: string, message: string }
 * - to: Phone number with country code (e.g., "+1234567890")
 * - message: Text message to send
 */

import { NextRequest, NextResponse } from "next/server";
import { sendTwilioWhatsApp } from "@/lib/twilio-whatsapp";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { whatsappNotifySchema } from "@/lib/schemas";
import { requireRole } from "@/lib/auth-context";

export async function POST(req: NextRequest) {
  try {
    // W6-HIGH-13: this endpoint previously only required an authenticated
    // session, which let any staff user blast WhatsApp messages via the
    // network tab. Gate on owner/manager so customer-facing WhatsApp sends
    // go through someone accountable for outbound comms volume.
    let ctx;
    try {
      ctx = await requireRole("owner", "manager");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "Not authenticated") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (msg.startsWith("role_denied:")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit WhatsApp notifications per user
    const { success } = await checkRateLimit(`whatsapp-notify:${ctx.userId}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parseResult = whatsappNotifySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { to, message } = parseResult.data;

    const result = await sendTwilioWhatsApp(to, message);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err) {
    logger.error("[notifications/whatsapp]", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
