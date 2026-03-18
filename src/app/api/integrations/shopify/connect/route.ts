/**
 * GET /api/integrations/shopify/connect
 * 
 * Initiates Shopify OAuth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/integrations";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SCOPES = "read_products,write_products,read_inventory,write_inventory,read_orders";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    
    // Get shop domain from query param
    const shop = req.nextUrl.searchParams.get("shop");
    
    if (!shop) {
      // Show shop input form
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?shopify=enter`
      );
    }

    // Build OAuth URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`;
    const state = Buffer.from(JSON.stringify({ tenantId })).toString("base64");
    
    const params = new URLSearchParams({
      client_id: SHOPIFY_CLIENT_ID,
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
    });
    
    const authUrl = `https://${shop}.myshopify.com/admin/oauth/authorize?${params.toString()}`;
    
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[shopify/connect]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=auth_failed`
    );
  }
}
