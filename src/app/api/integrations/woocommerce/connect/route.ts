/**
 * POST /api/integrations/woocommerce/connect
 * 
 * Connect WooCommerce store using REST API credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, upsertIntegration } from "@/lib/integrations";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const body = await req.json();
    
    const { store_url, consumer_key, consumer_secret } = body;

    if (!store_url || !consumer_key || !consumer_secret) {
      return NextResponse.json(
        { error: "Store URL, Consumer Key, and Consumer Secret are required" },
        { status: 400 }
      );
    }

    // Clean store URL
    const cleanUrl = store_url.replace(/\/$/, "");

    // Verify credentials by fetching store info
    const authString = Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");
    
    const verifyResponse = await fetch(`${cleanUrl}/wp-json/wc/v3/system_status`, {
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    if (!verifyResponse.ok) {
      const status = verifyResponse.status;
      if (status === 401) {
        return NextResponse.json(
          { error: "Invalid API credentials" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Could not connect to WooCommerce store" },
        { status: 400 }
      );
    }

    const storeInfo = await verifyResponse.json();

    // Store credentials
    const { error } = await upsertIntegration(
      tenantId,
      "woocommerce",
      {
        store_url: cleanUrl,
        consumer_key,
        consumer_secret,
        store_name: storeInfo.environment?.site_title || "WooCommerce Store",
        wc_version: storeInfo.environment?.version,
        connected_at: new Date().toISOString(),
      },
      "connected"
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      store_name: storeInfo.environment?.site_title,
    });
  } catch (err) {
    console.error("[woocommerce/connect]", err);
    return NextResponse.json(
      { error: "Failed to connect" },
      { status: 500 }
    );
  }
}
