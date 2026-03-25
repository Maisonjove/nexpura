/**
 * POST /api/integrations/whatsapp/connect
 * 
 * Connect WhatsApp Business API credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, upsertIntegration } from "@/lib/integrations";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    
    const { phone_number_id, access_token, business_account_id } = body;

    if (!phone_number_id || !access_token) {
      return NextResponse.json(
        { error: "Phone Number ID and Access Token are required" },
        { status: 400 }
      );
    }

    // Verify credentials by making a test API call
    const verifyResponse = await fetch(
      `https://graph.facebook.com/v18.0/${phone_number_id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      logger.error("[whatsapp/connect] Verification failed:", errorData);
      return NextResponse.json(
        { error: errorData.error?.message || "Invalid credentials" },
        { status: 400 }
      );
    }

    const phoneData = await verifyResponse.json();

    // Store credentials
    const { error } = await upsertIntegration(
      tenantId,
      "whatsapp",
      {
        phone_number_id,
        access_token,
        business_account_id: business_account_id || null,
        verified_phone: phoneData.verified_name || phoneData.display_phone_number,
        connected_at: new Date().toISOString(),
      },
      "connected"
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      phone: phoneData.verified_name || phoneData.display_phone_number,
    });
  } catch (err) {
    logger.error("[whatsapp/connect]", err);
    return NextResponse.json(
      { error: "Failed to connect" },
      { status: 500 }
    );
  }
}
