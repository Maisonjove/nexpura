import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkSubdomainQuerySchema } from "@/lib/schemas";
import { reportServerError } from "@/lib/logger";

/**
 * /api/check-subdomain — second route-by-route cacheComponents migration
 * template. First was /settings/tags (a page route); this is the shape
 * every other API route handler should adopt when we migrate it.
 *
 * BLOCKER (pre-migration):
 *   When `cacheComponents: true` is enabled globally, Next.js treats GET
 *   route handlers like pages — it attempts to prerender them at build
 *   time. This handler reads `request.headers.get("x-forwarded-for")`
 *   on line 1 of its body, which is a runtime-only data source. The
 *   build log for commit 40cf0d0 captured the exact failure:
 *
 *     Route /api/check-subdomain needs to bail out of prerendering at
 *     this point because it used request.headers.
 *       > const ip = request.headers.get("x-forwarded-for")?...
 *                            ^
 *       digest: 'NEXT_PRERENDER_INTERRUPTED'
 *
 *   The handler's remaining async work (rate-limit check, Supabase
 *   query) continues AFTER the prerender bail, which produces
 *   HANGING_PROMISE_REJECTION at build.
 *
 * FIX:
 *   Call `await connection()` from `next/server` BEFORE any
 *   request-scoped access. `connection()` is Next 16's explicit
 *   "defer to request time" primitive:
 *
 *     - During prerender: the promise NEVER resolves. The handler's
 *       subsequent code never runs, so the prerender pipeline sees
 *       nothing to evaluate and cleanly skips this route.
 *     - During a real request: the promise resolves immediately. The
 *       handler runs normally, exactly like today.
 *
 *   Under the CURRENT (pre-cacheComponents) model this is a no-op —
 *   `connection()` still exists in Next 16 and resolves immediately
 *   during normal rendering. So the line is safe to ship right now
 *   and becomes load-bearing when the global flag flips.
 *
 * PATTERN FOR OTHER API ROUTES:
 *   Any GET route handler that reads `request.headers`, `request.cookies`,
 *   `cookies()`, `headers()`, or makes request-scoped DB/auth calls at
 *   the top of its body should add `await connection();` as the very
 *   first line inside the `try` block. That's the whole migration for
 *   this class of route — no structural refactor required.
 *
 *   The other candidates in the blocker list — /api/integrations/
 *   shopify/connect, google-calendar/connect, /api/health/concurrency,
 *   /api/warm — all fit this same shape. Each is a one-line addition.
 *
 *   (POST handlers are NOT prerendered, so they don't need connection().
 *   Only GET handlers.)
 */

// Reserved subdomains that cannot be used
const RESERVED = [
  "www", "app", "api", "admin", "demo", "staging", "test",
  "mail", "email", "smtp", "ftp", "cdn", "static", "assets",
  "help", "support", "docs", "blog", "news", "status",
  "account", "accounts", "billing", "payments", "checkout",
  "login", "logout", "signup", "register", "auth",
  "nexpura", "team", "staff", "internal", "dev", "development",
];

export async function GET(request: NextRequest) {
  // CC-migration marker: explicitly defer this handler to request time.
  // Under cacheComponents this prevents the prerender pipeline from
  // attempting to evaluate the body (which reads request.headers and
  // would throw NEXT_PRERENDER_INTERRUPTED / HANGING_PROMISE_REJECTION).
  // Under the current model this resolves immediately — no-op.
  await connection();

  try {
    // Rate limit subdomain checks to prevent enumeration
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
    const { success: rateLimitOk } = await checkRateLimit(`check-subdomain:${ip}`);
    if (!rateLimitOk) {
      return NextResponse.json({ available: false, error: "Too many requests" }, { status: 429 });
    }

    const parseResult = checkSubdomainQuerySchema.safeParse({
      subdomain: request.nextUrl.searchParams.get("subdomain"),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { available: false, error: parseResult.error.issues[0]?.message || "Invalid subdomain" },
        { status: 400 }
      );
    }

    // Normalize to lowercase
    const normalized = parseResult.data.subdomain.toLowerCase().trim();

    // Check reserved list
    if (RESERVED.includes(normalized)) {
      return NextResponse.json({
        available: false,
        error: "This subdomain is reserved",
      });
    }

    // Check database for existing tenant with this subdomain
    const supabase = createAdminClient();

    const { data: existingBySubdomain } = await supabase
      .from("tenants")
      .select("id")
      .eq("subdomain", normalized)
      .maybeSingle();

    if (existingBySubdomain) {
      return NextResponse.json({
        available: false,
        error: "This subdomain is already taken",
      });
    }

    // Also check slug (for backward compatibility)
    const { data: existingBySlug } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", normalized)
      .maybeSingle();

    if (existingBySlug) {
      return NextResponse.json({
        available: false,
        error: "This subdomain is already taken",
      });
    }

    // Phase 2 builder writes the chosen subdomain to website_config.subdomain
    // (unique constraint at the DB level), not tenants.subdomain — so the two
    // checks above miss collisions for any tenant that's gone through the new
    // builder flow. Pre-fix this returned available:true for taken subdomains
    // and the user only learned at save time via an opaque DB UNIQUE error.
    const { data: existingByConfig } = await supabase
      .from("website_config")
      .select("tenant_id")
      .eq("subdomain", normalized)
      .maybeSingle();

    if (existingByConfig) {
      return NextResponse.json({
        available: false,
        error: "This subdomain is already taken",
      });
    }

    return NextResponse.json({
      available: true,
      subdomain: normalized,
    });
  } catch (error) {
    reportServerError("check-subdomain:GET", error);
    return NextResponse.json({ available: false, error: "Check failed" }, { status: 500 });
  }
}
