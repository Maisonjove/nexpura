import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getSubdomain, getTenantBySlug } from "@/lib/subdomain";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Review / staff bypass tokens ─────────────────────────────────────────
// SECURITY: No hardcoded fallback. Both tokens MUST be set as env vars.
// If they are not set the bypass feature is simply disabled — no one can
// accidentally bypass subscription gates using a publicly-visible string.
// Set REVIEW_BYPASS_TOKEN and STAFF_BYPASS_TOKEN in Vercel / .env.local.
const REVIEW_TOKEN = process.env.REVIEW_BYPASS_TOKEN ?? "";
const STAFF_TOKEN  = process.env.STAFF_BYPASS_TOKEN  ?? "";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("MIDDLEWARE_TIMEOUT")), ms)
  );
  return Promise.race([promise, timeout]);
}

// ── Subscription cache cookie ─────────────────────────────────────────────
// Cache the subscription OK status for 5 minutes per user to avoid
// two DB round-trips on every page request (the biggest middleware cost).
const SUB_CACHE_COOKIE = "nexpura-sub-ok";
const SUB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getSubCacheUserId(req: NextRequest): string | null {
  const cookie = req.cookies.get(SUB_CACHE_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const [userId, ts] = cookie.split("|");
    if (!userId || !ts) return null;
    if (Date.now() - parseInt(ts, 10) < SUB_CACHE_TTL_MS) return userId;
  } catch {
    // invalid cookie format
  }
  return null;
}

function setSubCacheCookie(response: NextResponse, userId: string): void {
  response.cookies.set(SUB_CACHE_COOKIE, `${userId}|${Date.now()}`, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: Math.floor(SUB_CACHE_TTL_MS / 1000),
    path: "/",
  });
}

// ── Shared subscription check ─────────────────────────────────────────────
async function checkSubscriptionAndRedirect(
  req: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  try {
    // Auth check — use SSR client so session cookies are honoured
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return response;

    // ── Subscription cache: skip DB queries if we recently confirmed OK ──
    // Cookie stores "{userId}|{timestamp}". If it's fresh and matches the
    // current user, we know the subscription was good recently — skip the
    // two extra DB round-trips (users + subscriptions lookups).
    const cachedUserId = getSubCacheUserId(req);
    if (cachedUserId === user.id) {
      // Still valid — no DB queries needed, refresh the cache window
      setSubCacheCookie(response, user.id);
      return response;
    }

    // SECURITY FIX: use admin client for users table lookup.
    // The anon/RLS client causes infinite policy recursion on the users table,
    // adding 1-2 s of latency to every single page request (it fires on every
    // non-exempt path). Switch to the service-role client to avoid this.
    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return response;

    const { data: subscription } = await admin
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

    // Subscription is good — cache result to skip DB checks for 5 minutes
    setSubCacheCookie(response, user.id);
  } catch (err) {
    console.error("[middleware] subscription check failed — passing through:", err);
  }
  return response;
}

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
    pathname.startsWith("/dashboard") || // Skip sub check for dashboard - it has its own auth
    pathname.includes(".")
  );
}

function isBypassRequest(req: NextRequest): boolean {
  // If env vars are not set, bypass is completely disabled (tokens are empty strings)
  if (!REVIEW_TOKEN && !STAFF_TOKEN) return false;
  const rtParam = req.nextUrl.searchParams.get("rt");
  const reviewCookie = req.cookies.get("nexpura-review")?.value;
  const staffCookie  = req.cookies.get("nexpura-staff")?.value;
  return (
    (REVIEW_TOKEN && (rtParam === REVIEW_TOKEN || reviewCookie === REVIEW_TOKEN)) ||
    (STAFF_TOKEN  && (rtParam === STAFF_TOKEN  || staffCookie  === STAFF_TOKEN))
  ) as boolean;
}

// ── Security Headers ─────────────────────────────────────────────────────
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy - allow Stripe, Supabase, analytics, and image CDNs
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://*.supabase.co https://*.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://*.vercel-insights.com https://*.google-analytics.com https://*.googleapis.com",
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://*.supabase.co",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  // HSTS is handled by Vercel automatically for production domains with HTTPS
  // But we set it explicitly for non-Vercel deployments
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
}

export async function middleware(request: NextRequest) {
  try {
    const response = await withTimeout(_proxyInner(request), 5000);
    return addSecurityHeaders(response);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "MIDDLEWARE_TIMEOUT";
    if (!isTimeout) {
      console.error("[middleware] unexpected error — passing through:", err);
    }
    const fallbackResponse = NextResponse.next();
    return addSecurityHeaders(fallbackResponse);
  }
}

async function _proxyInner(request: NextRequest) {
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
