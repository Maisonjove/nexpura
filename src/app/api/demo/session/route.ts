import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/demo/session
 *
 * Signs in as the demo user (demo@nexpura.com) and redirects to /dashboard.
 * Sets real Supabase auth cookies — all 15+ protected screens become accessible.
 *
 * Public route (middleware allows /api/*). Demo tenant only. Read-only intent.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "auth");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const response = NextResponse.redirect(`${baseUrl}/dashboard`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: "demo@nexpura.com",
    password: "nexpura-demo-2026",
  });

  if (error) {
    logger.error("[demo/session] Sign-in failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Cookies were set on `response` via setAll — redirect carries them
  return response;
}
