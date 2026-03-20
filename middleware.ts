import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getSubdomain, getTenantBySlug } from "@/lib/subdomain";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Review / staff bypass tokens ──────────────────────────────────────────
// Set REVIEW_BYPASS_TOKEN and STAFF_BYPASS_TOKEN in your .env.local and Vercel env settings.
// The fallback strings below are for local dev only — remove them before going to production.
const REVIEW_TOKEN = process.env.REVIEW_BYPASS_TOKEN ?? "nexpura-review-2026";
const STAFF_TOKEN = process.env.STAFF_BYPASS_TOKEN ?? "nexpura-staff-2026";

// Timeout wrapper to prevent middleware from hanging when Supabase is slow
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("MIDDLEWARE_TIMEOUT")), ms)
  );
  return Promise.race([promise, timeout]);
}

// ── Shared subscription check ─────────────────────────────────────────────
// Extracted so both the subdomain path and the standard path share one implementation.
async function checkSubscriptionAndRedirect(
  req: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              req.cookies.set(name, value)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return response;

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!userData?.tenant_id) return response;

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (
      subscription?.status === "suspended" ||
      subscription?.status === "payment_required"
    ) {
      const billingUrl = req.nextUrl.clone();
      billingUrl.pathname = "/billing";
      return NextResponse.redirect(billingUrl);
    }
  } catch (err) {
    console.error("[middleware] subscription check failed — passing through:", err);
  }
  return response;
}

// ── Helper: is this path exempt from subscription checks? ────────────────
function isExemptPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/features") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.includes(".")
  );
}

// ── Helper: is this a review/staff bypass request? ────────────────────────
function isBypassRequest(req: NextRequest): boolean {
  const rtParam = req.nextUrl.searchParams.get("rt");
  const reviewCookie = req.cookies.get("nexpura-review")?.value;
  const staffCookie = req.cookies.get("nexpura-staff")?.value;
  return (
    rtParam === REVIEW_TOKEN ||
    reviewCookie === REVIEW_TOKEN ||
    rtParam === STAFF_TOKEN ||
    staffCookie === STAFF_TOKEN
  );
}

export async function middleware(request: NextRequest) {
  try {
    return await withTimeout(_proxyInner(request), 5000);
  } catch (err) {
    const isTimeout =
      err instanceof Error && err.message === "MIDDLEWARE_TIMEOUT";
    if (!isTimeout) {
      console.error("[middleware] unexpected error — passing through:", err);
    }
    return NextResponse.next();
  }
}

async function _proxyInner(request: NextRequest) {
  // ── Subdomain tenant routing: acme.nexpura.com → inject x-subdomain-tenant-id ──
  const host = request.headers.get("host") ?? "";
  const subdomain = getSubdomain(host);

  if (subdomain) {
    try {
      const tenantId = await getTenantBySlug(subdomain, createAdminClient());
      if (tenantId) {
        const subdomainHeaders = new Headers(request.headers);
        subdomainHeaders.set("x-subdomain-tenant-id", tenantId);
        subdomainHeaders.set("x-subdomain-slug", subdomain);

        const enrichedRequest = new NextRequest(request.url, {
          headers: subdomainHeaders,
          method: request.method,
          body: request.body,
        });

        const response = await updateSession(enrichedRequest);
        const pathname = enrichedRequest.nextUrl.pathname;

        if (isBypassRequest(enrichedRequest)) return response;
        if (isExemptPath(pathname)) return response;
        return await checkSubscriptionAndRedirect(enrichedRequest, response);
      }
    } catch (err) {
      console.error("[proxy] subdomain lookup failed:", err);
    }
  }

  // ── Standard (non-subdomain) path ────────────────────────────────────────
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  if (isBypassRequest(request)) return response;
  if (isExemptPath(pathname)) return response;

  return await checkSubscriptionAndRedirect(request, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export default middleware;
