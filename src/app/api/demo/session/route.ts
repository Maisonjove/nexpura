import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";


/**
 * GET /api/demo/session
 *
 * Signs in as the demo user (demo@nexpura.com) and redirects to /dashboard.
 * Sets real Supabase auth cookies — all 15+ protected screens become accessible.
 *
 * SECURITY: Disabled in production. Only works in preview/development.
 */
export async function GET(request: NextRequest) {
  // SECURITY: Block demo session access in production
  const isProduction = process.env.NODE_ENV === "production" && 
    !process.env.VERCEL_ENV?.includes("preview") &&
    process.env.ENABLE_DEMO_MODE !== "true";
    
  if (isProduction) {
    logger.warn("[demo/session] Blocked demo session access in production");
    return NextResponse.json({ error: "Demo mode is disabled" }, { status: 403 });
  }

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
