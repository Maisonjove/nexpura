import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getSubdomain, getTenantBySlug } from "@/lib/subdomain";
import { createAdminClient } from "@/lib/supabase/admin";

// Review / staff bypass tokens
const REVIEW_TOKEN = process.env.REVIEW_BYPASS_TOKEN ?? "";
const STAFF_TOKEN = process.env.STAFF_BYPASS_TOKEN ?? "";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("MIDDLEWARE_TIMEOUT")), ms)
  );
  return Promise.race([promise, timeout]);
}

// Tenant ID cache cookie
// Cache the slugâtenantId mapping in a cookie to avoid a DB round-trip on
// every single request. The slugâID mapping is stable so 24h TTL is safe.
const TENANT_CACHE_COOKIE = "nexpura-tid";
const TENANT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachedTenantId(req: NextRequest, slug: string): string | null {
  const cookie = req.cookies.get(TENANT_CACHE_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const parts = cookie.split("|");
    const cachedSlug = parts[0];
    const tenantId = parts[1];
    const ts = parts[2];
    if (cachedSlug === slug && tenantId && ts) {
      if (Date.now() - parseInt(ts, 10) < TENANT_CACHE_TTL_MS) {
        return tenantId;
      }
    }
  } catch {
    // malformed cookie
  }
  return null;
}

function setTenantCacheCookie(
  response: NextResponse,
  slug: string,
  tenantId: string
): void {
  response.cookies.set(
    TENANT_CACHE_COOKIE,
    slug + "|" + tenantId + "|" + String(Date.now()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
    }
  );
}

// Subscription cache cookie
const SUB_CACHE_COOKIE = "nexpura-sub-ok";
const SUB_CACHE_TTL_MS = 5 * 60 * 1000;

function getSubCacheUserId(req: NextRequest): string | null {
  const cookie = req.cookies.get(SUB_CACHE_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const [userId, ts] = cookie.split("|");
    if (!userId || !ts) return null;
    if (Date.now() - parseInt(ts, 10) < SUB_CACHE_TTL_MS) return userId;
  } catch {
    // invalid cookie
  }
  return null;
}

function setSubCacheCookie(response: NextResponse, userId: string): void {
  response.cookies.set(SUB_CACHE_COOKIE, userId + "|" + String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: Math.floor(SUB_CACHE_TTL_MS / 1000),
    path: "/",
  });
}

// Shared subscription check
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
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return response;
    const cachedUserId = getSubCacheUserId(req);
    if (cachedUserId === user.id) {
      setSubCacheCookie(response, user.id);
      return response;
    }
    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users").select("tenant_id").eq("id", user.id).single();
    if (!userData?.tenant_id) return response;
    const { data: subscription } = await admin
      .from("subscriptions").select("status").eq("tenant_id", userData.tenant_id).single();
    if (
      subscription?.status === "suspended" ||
      subscription?.status === "payment_required"
    ) {
      const billingUrl = req.nextUrl.clone();
      billingUrl.pathname = "/billing";
      return NextResponse.redirect(billingUrl);
    }
    setSubCacheCookie(response, user.id);
  } catch (err) {
    console.error("[middleware] subscription check failed -- passing through:", err);
  }
  return response;
}

// Known app route segments â used to detect /{slug}/{route} tenant-aware URLs.
// If the second segment is a known app route and the first is NOT, it's a tenant slug path.
const EXEMPT_TENANT_ROUTES = new Set([
  "dashboard", "intake", "pos", "sales", "invoices", "quotes", "laybys",
  "inventory", "customers", "suppliers", "memo", "stocktakes",
  "repairs", "bespoke", "workshop", "appraisals", "passports",
  "expenses", "financials", "reports", "refunds", "vouchers", "eod",
  "marketing", "tasks", "copilot", "website", "documents",
  "integrations", "reminders", "support", "settings", "billing",
  "suspended", "communications", "notifications", "migration", "ai",
  "enquiries", "print-queue", "actions",
]);

// Exempt paths
function isExemptPath(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/features") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/bespoke") ||
    pathname.startsWith("/repairs") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/passports") ||
    pathname.startsWith("/suspended") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/suppliers") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/communications") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/marketing") ||
    pathname.startsWith("/ai") ||
    pathname.startsWith("/pos") ||
    pathname.includes(".")
  ) {
    return true;
  }
  // Tenant-aware URLs /{slug}/{route} â auth and subscription already handled in updateSession
  const segs = pathname.split("/").filter(Boolean);
  if (
    segs.length >= 2 &&
    EXEMPT_TENANT_ROUTES.has(segs[1]) &&
    !EXEMPT_TENANT_ROUTES.has(segs[0])
  ) {
    return true;
  }
  return false;
}

function isBypassRequest(req: NextRequest): boolean {
  if (!REVIEW_TOKEN && !STAFF_TOKEN) return false;
  const rtParam = req.nextUrl.searchParams.get("rt");
  const reviewCookie = req.cookies.get("nexpura-review")?.value;
  const staffCookie = req.cookies.get("nexpura-staff")?.value;
  return (
    (REVIEW_TOKEN && (rtParam === REVIEW_TOKEN || reviewCookie === REVIEW_TOKEN)) ||
    (STAFF_TOKEN && staffCookie === STAFF_TOKEN)
  ) as boolean;
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://*.supabase.co https://*.vercel-scripts.com https://www.annot8.dev https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://*.vercel-insights.com https://*.google-analytics.com https://*.googleapis.com https://www.annot8.dev",
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://*.supabase.co",
    "frame-ancestors 'self' https://annot8.dev https://*.annot8.dev https://openclaw.ai https://*.openclaw.ai https://astry.agency https://*.astry.agency",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export async function middleware(request: NextRequest) {
  try {
    const response = await withTimeout(_proxyInner(request), 4500);
    return addSecurityHeaders(response);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "MIDDLEWARE_TIMEOUT";
    if (!isTimeout) console.error("[middleware] unexpected error -- passing through:", err);
    return addSecurityHeaders(NextResponse.next());
  }
}

async function _proxyInner(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const subdomain = getSubdomain(host);

  if (subdomain) {
    try {
      let tenantId = getCachedTenantId(request, subdomain);
      const wasFromCache = tenantId !== null;
      if (!tenantId) {
        tenantId = await getTenantBySlug(subdomain, createAdminClient());
      }
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
        if (!wasFromCache) setTenantCacheCookie(response, subdomain, tenantId);
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export default middleware;
