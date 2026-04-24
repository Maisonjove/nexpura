import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getSubdomain, getTenantBySlug } from "@/lib/subdomain";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeCompare } from "@/lib/timing-safe-compare";

// Review / staff bypass tokens. Prefer the canonical NEXPURA_* names
// (matches src/lib/auth/review.ts); fall back to the legacy REVIEW_BYPASS_TOKEN
// / STAFF_BYPASS_TOKEN names so existing Vercel env vars keep working during
// the consolidation.
const REVIEW_TOKEN =
  process.env.NEXPURA_REVIEW_TOKEN ?? process.env.REVIEW_BYPASS_TOKEN ?? "";
const STAFF_TOKEN =
  process.env.NEXPURA_STAFF_BYPASS_TOKEN ?? process.env.STAFF_BYPASS_TOKEN ?? "";

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
  // Constant-time compares on every shared-secret check so an attacker
  // with a responsive endpoint can't recover the token byte-by-byte
  // via timing measurements over repeated probes.
  if (!REVIEW_TOKEN && !STAFF_TOKEN) return false;
  const rtParam = req.nextUrl.searchParams.get("rt");
  const reviewCookie = req.cookies.get("nexpura-review")?.value ?? null;
  const staffCookie = req.cookies.get("nexpura-staff")?.value ?? null;
  const reviewOk = REVIEW_TOKEN && (safeCompare(rtParam, REVIEW_TOKEN) || safeCompare(reviewCookie, REVIEW_TOKEN));
  const staffOk = STAFF_TOKEN && safeCompare(staffCookie, STAFF_TOKEN);
  return Boolean(reviewOk || staffOk);
}

// ─── Hot-route RSC prefetch cache-safety override ────────────────────────────
// The Service Worker at public/sw.js caches fetches that come through its
// fetch handler, using the Cache API. Cache.match respects the server's
// Vary header when matching responses to requests. Next.js sets
// `Vary: rsc, next-router-state-tree, next-router-prefetch,
// next-router-segment-prefetch` on RSC responses — but NOT `cookie`.
// Without `cookie` in Vary, the SW cache would happily serve User A's
// cached customer/repair/… response to User B on the same browser after
// a logout/login cycle. Cross-user leak.
//
// We augment the Vary header on hot-route RSC prefetch responses to
// include `cookie`, so the SW cache (and any future browser HTTP cache
// if Next ever relaxes the no-store default) partitions cleanly per
// authenticated session. Logout/login rotates cookies → new Vary key →
// cache miss → no stale user data served.
//
// Scope is narrow: only for the 8 hot tenant-prefixed routes AND only
// when `rsc: 1` + `next-router-prefetch: 1` request headers are set.
// All other responses are untouched.
const HOT_ROUTE_SEGMENTS = new Set([
  "customers",
  "repairs",
  "inventory",
  "tasks",
  "invoices",
  "workshop",
  "bespoke",
  "intake",
]);

function isHotRoutePrefetchRequest(req: NextRequest): boolean {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  // tenant-prefixed: /{slug}/{route}
  if (segments.length !== 2) return false;
  if (!HOT_ROUTE_SEGMENTS.has(segments[1])) return false;
  if (req.headers.get("rsc") !== "1") return false;
  if (req.headers.get("next-router-prefetch") !== "1") return false;
  return true;
}

function augmentVaryForHotPrefetch(
  request: NextRequest,
  response: NextResponse,
): void {
  if (!isHotRoutePrefetchRequest(request)) return;
  const existing = response.headers.get("Vary") ?? "";
  if (/\bcookie\b/i.test(existing)) return;
  response.headers.set(
    "Vary",
    existing ? `${existing}, cookie` : "cookie",
  );
}

// Single source of truth for the Content-Security-Policy and the
// clickjack/framing controls. Previously set in two places (next.config
// `securityHeaders` + this middleware) with diverging origin lists — the
// middleware version won because next.config's header() runs first and
// gets overwritten here, but the drift was a trap. next.config keeps only
// the static, never-changing controls (HSTS, Permissions-Policy, COOP,
// CORP, etc.); everything CSP-related lives here.
//
// X-Frame-Options was also set alongside with `DENY`, which conflicts
// with the `frame-ancestors 'self' https://annot8.dev ...` in the CSP.
// The spec says CSP frame-ancestors supersedes X-Frame-Options when both
// are present, so the end behaviour matched the CSP — but the presence
// of the header is misleading. Removed.
function addSecurityHeaders(response: NextResponse): NextResponse {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-scripts.com https://*.supabase.co https://*.sentry.io https://*.sentry-cdn.com https://js.stripe.com https://checkout.stripe.com https://www.annot8.dev https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://images.unsplash.com https://*.stripe.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://api.stripe.com https://checkout.stripe.com https://*.vercel-insights.com https://*.google-analytics.com https://*.googleapis.com https://www.annot8.dev",
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://*.supabase.co",
    "frame-ancestors 'self' https://annot8.dev https://*.annot8.dev https://openclaw.ai https://*.openclaw.ai https://astry.agency https://*.astry.agency",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

// CSRF gate for mutating /api/** requests. Audit finding (High): the
// CSRF validator existed but was only wired into a single route. Cross-
// origin POSTs to routes like /api/job-attachment, /api/2fa/*,
// /api/bespoke/approval-response were accepted by default. Enforced
// here as a middleware choke point so all API routes are covered
// without per-file edits. Exemptions:
//   - Webhooks (/api/webhooks/**) come from third-party origins
//     (Stripe, Resend) and verify their own HMAC signatures.
//   - Integration webhooks (/api/integrations/<vendor>/webhook) —
//     WooCommerce, Shopify, etc. — are third-party-origin POSTs with
//     their own HMAC verification. Before this exemption they 403'd
//     at CSRF before the HMAC check even ran.
//   - Crons (/api/cron/**) are invoked by Vercel Cron, no origin header.
//   - The auth login + 2fa-validate endpoints are hit by the /login
//     page first-party POST and by the Supabase mobile client which
//     also lacks our origin; they are rate-limited + session-authed.
//     Other /api/auth/** endpoints (2fa/disable, 2fa/setup, sessions/*,
//     logout) MUST go through CSRF because an attacker page could
//     otherwise disable 2FA or log you out with a simple cross-origin
//     fetch on a signed-in browser.
function isCsrfExemptApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/api/auth/2fa/validate") ||
    pathname.startsWith("/api/auth/2fa/sms/send-login") ||
    pathname.startsWith("/api/auth/2fa/sms/verify-login") ||
    pathname.startsWith("/api/stripe/") || // Stripe-side redirect endpoints
    // Integration webhooks: vendor-origin POSTs with HMAC verification.
    (pathname.startsWith("/api/integrations/") && pathname.endsWith("/webhook"))
  );
}
function isMutatingMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH";
}
async function enforceApiCsrf(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) return null;
  if (isCsrfExemptApi(pathname)) return null;
  if (!isMutatingMethod(request.method)) return null;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originOk = (check: string | null): boolean => {
    if (!check) return false;
    try {
      const u = new URL(check);
      if (u.origin === appUrl) return true;
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
      if (u.hostname.endsWith(".vercel.app")) return true;
      // Tenant subdomains on the main product domain.
      if (appUrl) {
        const appHost = new URL(appUrl).hostname;
        if (u.hostname === appHost || u.hostname.endsWith("." + appHost)) return true;
      }
      return false;
    } catch {
      return false;
    }
  };
  if (originOk(origin) || originOk(referer)) return null;
  return new NextResponse(
    JSON.stringify({ error: "Invalid request origin" }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

// Names of the auth headers that middleware sets from the verified session
// and that downstream server actions / route handlers trust. Listed here so
// this file owns the scrub list. Any new x-auth-* header added to
// AUTH_HEADERS in lib/cached-auth must also be appended here.
const FORGEABLE_AUTH_HEADERS = [
  "x-auth-user-id",
  "x-auth-tenant-id",
  "x-auth-user-role",
  "x-auth-user-email",
] as const;

function stripForgedAuthHeaders(request: NextRequest): NextRequest {
  // An attacker can freely send x-auth-* headers on any request. Downstream
  // `getAuthContext()` reads them as a perf fast-path assuming middleware
  // set them — so if we don't scrub inbound copies here, a forged tenant/
  // role/user lands in the route handler without any cookie or CSRF token.
  // The scrub is unconditional: middleware re-sets these from the verified
  // session via `NextResponse.next({ request: { headers: … } })` after
  // auth.getUser() succeeds, so legitimate paths are unaffected.
  const incoming = request.headers;
  const hasAny = FORGEABLE_AUTH_HEADERS.some((h) => incoming.has(h));
  if (!hasAny) return request;

  const sanitized = new Headers(incoming);
  for (const h of FORGEABLE_AUTH_HEADERS) sanitized.delete(h);
  return new NextRequest(request.url, {
    headers: sanitized,
    method: request.method,
    body: request.body,
  });
}

export async function middleware(request: NextRequest) {
  // SECURITY: strip forged auth headers BEFORE any branching. Fallback
  // / timeout paths below reuse this scrubbed request too so attackers
  // can't slip headers through on a middleware error.
  const scrubbed = stripForgedAuthHeaders(request);

  try {
    // CSRF gate before the main pipeline so auth side-effects don't
    // run on rejected cross-origin mutations.
    const csrfReject = await enforceApiCsrf(scrubbed);
    if (csrfReject) return addSecurityHeaders(csrfReject);

    const response = await withTimeout(_proxyInner(scrubbed), 4500);
    augmentVaryForHotPrefetch(scrubbed, response);
    return addSecurityHeaders(response);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "MIDDLEWARE_TIMEOUT";
    if (!isTimeout) console.error("[middleware] unexpected error -- passing through:", err);
    // Forward the SCRUBBED request on the fallback path so timeouts /
    // uncaught throws don't leak attacker-supplied x-auth-* into
    // downstream handlers.
    const fallback = NextResponse.next({ request: scrubbed });
    augmentVaryForHotPrefetch(scrubbed, fallback);
    return addSecurityHeaders(fallback);
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
