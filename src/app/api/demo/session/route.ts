import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/demo/session
 *
 * Generates a magic link for the demo user and redirects to it.
 * Supabase verifies the link and sets real auth session cookies,
 * then redirects to /dashboard — giving access to all 15+ screens.
 *
 * Public route — no auth required (middleware allows /api/*).
 */
export async function GET(request: Request) {
  const admin = createAdminClient();

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "demo@nexpura.com",
    options: {
      redirectTo: `${baseUrl}/dashboard`,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error("[demo/session] Failed to generate magic link:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Failed to generate demo session" },
      { status: 500 }
    );
  }

  // Redirect to Supabase magic link — it will verify, set cookies, then bounce to /dashboard
  return NextResponse.redirect(data.properties.action_link);
}
