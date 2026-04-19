import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import logger from "@/lib/logger";
import { AUTH_HEADERS, getCachedUserProfile } from "@/lib/cached-auth";
import { getCookieDomain, getIsSecure } from "@/lib/supabase/cookie-config";
import {
  extractAccessToken,
  isTokenFresh,
  verifyAccessTokenLocal,
  type LocalAuthUser,
} from "@/lib/supabase/jwt-verify";

// --- Subscription status cookie cache (5-min TTL) ---
// Skips the subscriptions DB query on every page nav once status is confirmed OK.
const SUB_CACHE_COOKIE = "nexpura-sub-v2";
const SUB_CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedSubOk(request: NextRequest, tenantId: string): boolean {
  const val = request.cookies.get(SUB_CACHE_COOKIE)?.value;
  if (!val) return false;
  try {
    const [cachedTenantId, ts] = val.split("|");
    if (cachedTenantId === tenantId && ts) {
      return Date.now() - parseInt(ts, 10) < SUB_CACHE_TTL_MS;
    }
  } catch {}
  return false;
}

function setSubOkCookie(
  response: NextResponse,
  tenantId: string,
  host: string | undefined,
  protocol: string | undefined
): void {
  response.cookies.set(SUB_CACHE_COOKIE, `${tenantId}|${Date.now()}`, {
    httpOnly: true,
    secure: getIsSecure(protocol, host),
    sameSite: "lax",
    maxAge: 300,
    path: "/",
    domain: getCookieDomain(host),
  });
}

// Routes that never need auth — skip Supabase entirely for instant response.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/support-access") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    // Marketing pages — static, no auth needed
    pathname.startsWith("/features") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/switching") ||
    pathname.includes(".")
  );
}

// Known app route segments — the second path segment in /{slug}/{route} must be one of these.
// Guard: if segments[0] is itself a known route (e.g. /repairs/dashboard), it cannot be a slug.
const TENANT_APP_ROUTES = new Set([
  "dashboard",
  "intake",
  "pos",
  "sales",
  "invoices",
  "quotes",
  "laybys",
  "inventory",
  "customers",
  "suppliers",
  "memo",
  "stocktakes",
  "repairs",
  "bespoke",
  "workshop",
  "appraisals",
  "passports",
  "expenses",
  "financials",
  "reports",
  "refunds",
  "vouchers",
  "eod",
  "marketing",
  "tasks",
  "copilot",
  "website",
  "documents",
  "integrations",
  "reminders",
  "support",
  "settings",
  "billing",
  "suspended",
  "communications",
  "notifications",
  "migration",
  "ai",
  "enquiries",
  "print-queue",
  "actions",
]);

function parseTenantSlugPath(
  pathname: string
): { slug: string; route: string } | null {
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length >= 2 &&
    TENANT_APP_ROUTES.has(segments[1]) &&
    !TENANT_APP_ROUTES.has(segments[0]) // guard: /repairs/dashboard — segments[0]="repairs" is a route — not a slug
  ) {
    return { slug: segments[0], route: "/" + segments.slice(1).join("/") };
  }
  return null;
}

/**
 * Transfer Supabase session cookies from a supabaseResponse onto a redirect response.
 * This ensures that any token refreshes that happened during the request are not
 * lost when we redirect — without this, the browser keeps sending stale tokens,
 * triggering "Invalid Refresh Token: Already Used" on every page load.
 */
function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse
): NextResponse {
  const redirect = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function updateSession(request: NextRequest) {
  try {
    return await _updateSessionInner(request);
  } catch (err) {
    logger.error("[middleware] updateSession threw:", err);
    const { pathname } = request.nextUrl;
    if (!isPublicPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }
}

async function _updateSessionInner(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Short-circuit for public & marketing routes — no Supabase round-trip needed.
  // This eliminates the 50-100ms auth.getUser() latency on every marketing page nav.
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let supabaseResponse = NextResponse.next({ request });

  const host = request.headers.get("host") || undefined;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto
    ? `${forwardedProto}:`
    : request.nextUrl.protocol;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      // httpOnly is intentionally omitted so the browser Supabase client
      // (createBrowserClient) can read and refresh session cookies via
      // document.cookie. Setting httpOnly here causes a cookie split where
      // the middleware writes httpOnly tokens the browser can't see, leading
      // to "Invalid Refresh Token: Already Used" on every navigation.
      secure: getIsSecure(protocol, host),
      sameSite: "lax",
      domain: getCookieDomain(host),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // ── FAST PATH: local JWT verification ────────────────────────────────
  // The slow path below (supabase.auth.getUser) round-trips to Supabase's
  // auth server on every protected nav (~150-300ms from Sydney → Supabase
  // Sydney DC). For any request with a fresh access token (> 5 min left of
  // its default 1h TTL) we can verify the JWT locally against the project's
  // JWKS (ES256, cached 1h in-process) in ~1-3ms. When the token is missing,
  // near expiry, or fails verification, we fall through to the slow path
  // which preserves Supabase's normal refresh-cookie flow.
  //
  // Trade-off: token-revocation lag for forced logout = remaining access-token
  // TTL. Not acceptable for security-critical admin flows — those should call
  // auth.getUser() explicitly. For normal page navigation this is safe.
  const accessToken = extractAccessToken(request.cookies.getAll());
  const localUser: LocalAuthUser | null = accessToken
    ? await verifyAccessTokenLocal(accessToken)
    : null;
  const useFastPath = isTokenFresh(localUser);

  let user: { id: string; email: string | null; email_confirmed_at: string | null } | null;
  if (useFastPath && localUser) {
    // Synthesize the minimal user shape middleware needs. email_confirmed_at
    // is normally an ISO string on the Supabase User; middleware only checks
    // truthy/falsy, so any non-empty string works.
    user = {
      id: localUser.id,
      email: localUser.email,
      email_confirmed_at: localUser.emailVerified ? "verified" : null,
    };
  } else {
    const { data } = await supabase.auth.getUser();
    user = data.user
      ? {
          id: data.user.id,
          email: data.user.email ?? null,
          email_confirmed_at: data.user.email_confirmed_at ?? null,
        }
      : null;
  }

  if (pathname.startsWith("/verify-email")) {
    return supabaseResponse;
  }

  const isOnboarding = pathname.startsWith("/onboarding");
  if (isOnboarding) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return redirectWithCookies(loginUrl, supabaseResponse);
    }
    if (!user.email_confirmed_at) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-email";
      return redirectWithCookies(verifyUrl, supabaseResponse);
    }
    return supabaseResponse;
  }

  const isAdminRoute = pathname.startsWith("/admin");
  if (isAdminRoute) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return redirectWithCookies(loginUrl, supabaseResponse);
    }
    return supabaseResponse;
  }

  // --- Tenant-slug URL routing: /{slug}/{route} ---
  // Validates the slug matches the authenticated user's tenant, sets AUTH headers,
  // and rewrites internally to the flat /{route} so page components need zero changes.
  const tenantParsed = parseTenantSlugPath(pathname);
  if (tenantParsed !== null) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return redirectWithCookies(loginUrl, supabaseResponse);
    }
    if (!user.email_confirmed_at) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-email";
      return redirectWithCookies(verifyUrl, supabaseResponse);
    }

    const userProfile = await getCachedUserProfile(user.id);
    if (!userProfile || !userProfile.tenant_id) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return redirectWithCookies(onboardingUrl, supabaseResponse);
    }

    const userTenantSlug = userProfile.tenants?.slug;
    if (userTenantSlug && userTenantSlug !== tenantParsed.slug) {
      // Cross-tenant URL: silently redirect user to their own correct tenant URL
      const correctUrl = request.nextUrl.clone();
      correctUrl.pathname = `/${userTenantSlug}${tenantParsed.route}`;
      return redirectWithCookies(correctUrl, supabaseResponse);
    }

    // Slug matches (or tenant has no slug yet) — set AUTH headers and rewrite internally
    const authRequestHeaders = new Headers(request.headers);
    authRequestHeaders.set(AUTH_HEADERS.USER_ID, user.id);
    authRequestHeaders.set(AUTH_HEADERS.TENANT_ID, userProfile.tenant_id);
    authRequestHeaders.set(AUTH_HEADERS.USER_ROLE, userProfile.role || "");
    authRequestHeaders.set(AUTH_HEADERS.USER_EMAIL, user.email || "");

    // Rewrite: browser keeps /{slug}/{route}, Next.js internally serves /{route}
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = tenantParsed.route;
    const authResponse = NextResponse.rewrite(rewriteUrl, {
      request: { headers: authRequestHeaders },
    });

    // Transfer all session cookies (preserves secure, sameSite, domain, etc.)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      authResponse.cookies.set(cookie);
    });

    // Check subscription (skip for billing/suspended pages)
    if (
      !tenantParsed.route.startsWith("/billing") &&
      !tenantParsed.route.startsWith("/suspended")
    ) {
      if (!getCachedSubOk(request, userProfile.tenant_id)) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status, current_period_end, trial_ends_at")
          .eq("tenant_id", userProfile.tenant_id)
          .maybeSingle();

        if (sub) {
          const now = new Date();
          const isTrialExpired =
            sub.status === "trialing" &&
            sub.trial_ends_at &&
            new Date(sub.trial_ends_at) < now;
          const isCancelledAndExpired =
            sub.status === "cancelled" &&
            sub.current_period_end &&
            new Date(sub.current_period_end) < now;
          const isBlocked =
            sub.status === "suspended" || isTrialExpired || isCancelledAndExpired;

          if (isBlocked) {
            const suspendedUrl = request.nextUrl.clone();
            suspendedUrl.pathname = userTenantSlug
              ? `/${userTenantSlug}/suspended`
              : "/suspended";
            return redirectWithCookies(suspendedUrl, supabaseResponse);
          }

          // Not blocked — cache the OK status for 5 minutes
          setSubOkCookie(authResponse, userProfile.tenant_id, host, protocol);
        }
      }
    }

    return authResponse;
  }

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/bespoke") ||
    pathname.startsWith("/repairs") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/passports") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/suspended") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/suppliers") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/communications") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/marketing") ||
    pathname.startsWith("/ai") ||
    pathname.startsWith("/pos");

  if (isProtectedRoute) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return redirectWithCookies(loginUrl, supabaseResponse);
    }
    if (!user.email_confirmed_at) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-email";
      return redirectWithCookies(verifyUrl, supabaseResponse);
    }

    const userProfile = await getCachedUserProfile(user.id);
    if (!userProfile || !userProfile.tenant_id) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return redirectWithCookies(onboardingUrl, supabaseResponse);
    }

    // Migrate flat URLs — tenant-aware URLs for bookmarkable, shareable routes.
    // Tenants with a slug get redirected; tenants without a slug fall through to flat-route mode.
    const userTenantSlug = userProfile.tenants?.slug;
    if (userTenantSlug) {
      const tenantUrl = request.nextUrl.clone();
      tenantUrl.pathname = `/${userTenantSlug}${pathname}`;
      return redirectWithCookies(tenantUrl, supabaseResponse);
    }

    // Fallback: tenant has no slug — serve flat route with AUTH headers as before
    const authRequestHeaders = new Headers(request.headers);
    authRequestHeaders.set(AUTH_HEADERS.USER_ID, user.id);
    authRequestHeaders.set(AUTH_HEADERS.TENANT_ID, userProfile.tenant_id);
    authRequestHeaders.set(AUTH_HEADERS.USER_ROLE, userProfile.role || "");
    authRequestHeaders.set(AUTH_HEADERS.USER_EMAIL, user.email || "");

    const authResponse = NextResponse.next({
      request: { headers: authRequestHeaders },
    });

    // Transfer all session cookies (preserves secure, sameSite, domain, etc.)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      authResponse.cookies.set(cookie);
    });

    if (
      !pathname.startsWith("/billing") &&
      !pathname.startsWith("/suspended")
    ) {
      // Check cookie cache before querying the DB (5-min TTL).
      // On cache miss, query DB; if not blocked, cache the OK result.
      if (!getCachedSubOk(request, userProfile.tenant_id)) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status, current_period_end, trial_ends_at")
          .eq("tenant_id", userProfile.tenant_id)
          .maybeSingle();

        if (sub) {
          const now = new Date();
          const isTrialExpired =
            sub.status === "trialing" &&
            sub.trial_ends_at &&
            new Date(sub.trial_ends_at) < now;
          const isCancelledAndExpired =
            sub.status === "cancelled" &&
            sub.current_period_end &&
            new Date(sub.current_period_end) < now;
          const isBlocked =
            sub.status === "suspended" || isTrialExpired || isCancelledAndExpired;

          if (isBlocked) {
            const suspendedUrl = request.nextUrl.clone();
            suspendedUrl.pathname = "/suspended";
            return redirectWithCookies(suspendedUrl, supabaseResponse);
          }

          // Not blocked — cache the OK status for 5 minutes
          setSubOkCookie(authResponse, userProfile.tenant_id, host, protocol);
        }
      }
    }

    return authResponse;
  }

  return supabaseResponse;
}
