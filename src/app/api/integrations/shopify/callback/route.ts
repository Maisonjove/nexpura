/**
 * GET /api/integrations/shopify/callback
 * 
 * OAuth callback from Shopify
 */

import { NextRequest, NextResponse } from "next/server";
import { upsertIntegration } from "@/lib/integrations";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error("[shopify/callback] OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=oauth_denied`
    );
  }

  if (!code || !shop || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=missing_params`
    );
  }

  try {
    // Decode state to get tenantId
    const { tenantId } = JSON.parse(Buffer.from(state, "base64").toString());
    
    if (!tenantId) {
      throw new Error("Invalid state - missing tenantId");
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[shopify/callback] Token exchange failed:", error);
      throw new Error("Token exchange failed");
    }

    const tokens = await tokenResponse.json();
    
    // Get shop info
    const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": tokens.access_token,
      },
    });

    let shopName = shop;
    if (shopResponse.ok) {
      const shopData = await shopResponse.json();
      shopName = shopData.shop?.name || shop;
    }

    // Store credentials
    const { error: upsertError } = await upsertIntegration(
      tenantId,
      "shopify",
      {
        shop,
        shop_name: shopName,
        access_token: tokens.access_token,
        scope: tokens.scope,
        connected_at: new Date().toISOString(),
      },
      "connected"
    );

    if (upsertError) {
      throw new Error(upsertError);
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?success=shopify_connected`
    );
  } catch (err) {
    console.error("[shopify/callback]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=callback_failed`
    );
  }
}
