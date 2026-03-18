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
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { to, message } = body as { to?: string; message?: string };

    if (!to || !message) {
      return NextResponse.json(
        { error: "to and message are required" },
        { status: 400 }
      );
    }

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
    console.error("[notifications/whatsapp]", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
