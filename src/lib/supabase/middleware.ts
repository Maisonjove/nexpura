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
import {
  TWO_FACTOR_COOKIE_NAME,
  verifyTwoFactorCookie,
} from "@/lib/auth/two-factor-cookie";
import {
  SHELL_COOKIE_NAME,
  verifyShellCookie,
} from "@/lib/dashboard/shell-cookie";

// Profile shape middleware actually consumes. Deliberately a narrow
// subset of the users/tenants row so both the shell-cookie fast path
// and the getCachedUserProfile slow path converge on it.
type MiddlewareProfile = {
  tenant_id: string;
  role: string;
  totp_enabled: boolean;
  slug: string | null;
};

/**
 * Resolve the middleware profile. Reads the HMAC-signed shell cookie
 * first (set at login with tenant_id/role/slug/totp_enabled baked in);
 * that's a ~0.5 ms Web-Crypto verify with no DB round-trip. On miss
 * (no cookie, tampered, expired, pre-rollout session, missing fields)
 * falls back to the DB path via getCachedUserProfile.
 */
async function resolveMiddlewareProfile(
  request: NextRequest,
  userId: string,
): Promise<MiddlewareProfile | null> {
  const shellValue = request.cookies.get(SHELL_COOKIE_NAME)?.value;
  const shell = await verifyShellCookie(shellValue, userId);
  if (
    shell &&
    shell.tenantId &&
    typeof shell.role === "string" &&
    typeof shell.totpEnabled === "boolean"
  ) {
    return {
      tenant_id: shell.tenantId,
      role: shell.role,
      totp_enabled: shell.totpEnabled,
      slug: shell.tenantSlug ?? null,
    };
  }
  const fallback = await getCachedUserProfile(userId);
  if (!fallback?.tenant_id) return null;
  return {
    tenant_id: fallback.tenant_id,
    role: fallback.role ?? "",
    totp_enabled: fallback.totp_enabled === true,
    slug: fallback.tenants?.slug ?? null,
  };
}

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

// ─── PR-05: 2FA AAL enforcement ──────────────────────────────────────
// Routes that must remain reachable for a session that is authed but
// hasn't proved possession of the second factor yet. Everything else is
// gated by `enforceTwoFactor` below.
//
//   /verify-2fa        – the factor-entry page itself
//   /api/auth/2fa/**   – the validate/verify/disable/setup endpoints
//   /api/auth/login    – initial sign-in + checkOnly2FA probe
//   /api/auth/logout   – clears the session/cookie
//   /api/auth/sessions – sessions list (server itself re-checks auth)
//   /logout            – the logout page
//
// Public routes are already short-circuited earlier in _updateSessionInner,
// so they never reach this gate.
function isTwoFactorExemptPath(pathname: string): boolean {
  return (
    pathname === "/verify-2fa" ||
    pathname.startsWith("/verify-2fa/") ||
    pathname.startsWith("/api/auth/2fa/") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname.startsWith("/api/auth/sessions") ||
    pathname === "/logout" ||
    pathname.startsWith("/logout/")
  );
}

// Inspect the user's TOTP flag + 2fa cookie and decide whether to let
// the request through. Returns a redirect to /verify-2fa when the user
// is enrolled in 2FA but has not proved possession on this browser.
//
// Fail-closed: if either (a) totp_enabled is true AND (b) the cookie is
// missing / tampered / bound to a different user / expired, we redirect.
async function enforceTwoFactor(
  request: NextRequest,
  userId: string,
  totpEnabled: boolean | null | undefined,
  supabaseResponse: NextResponse
): Promise<NextResponse | null> {
  if (!totpEnabled) return null;

  const pathname = request.nextUrl.pathname;
  if (isTwoFactorExemptPath(pathname)) return null;

  const cookie = request.cookies.get(TWO_FACTOR_COOKIE_NAME)?.value ?? null;
  if (await verifyTwoFactorCookie(cookie, userId)) return null;

  // Not proved — bounce to /verify-2fa with a returnTo for post-verify.
  const verifyUrl = request.nextUrl.clone();
  verifyUrl.pathname = "/verify-2fa";
  // Preserve the original search so a deep-linked nav still round-trips.
  const returnTo = pathname + (request.nextUrl.search || "");
  verifyUrl.search = `?returnTo=${encodeURIComponent(returnTo)}`;
  return redirectWithCookies(verifyUrl, supabaseResponse);
}

// Routes that never need auth — skip Supabase entirely for instant response.
//
// PRE-FIX: this returned true for any `/api/*` path. That short-circuited
// the entire auth + 2FA enforcement chain for API routes — a 2FA-enrolled
// user could hit /api/settings, /api/integrations, /api/billing/portal,
// etc. before completing 2FA. Page navs got the gate but API mutations
// did not. (Audit finding HIGH, 2026-04-25.)
//
// FIX: enumerate the API paths that actually have no auth (webhooks,
// public tracking/approval endpoints, login/2fa-flow routes) and let
// the rest fall through to the normal auth + AAL2 enforcement. Authed
// routes already call getUser() themselves so this only ADDS the
// middleware AAL2 gate without changing existing handler behaviour.
// Trade-off: ~50ms getUser() latency on previously-shortcut /api calls.
function isAlwaysPublicApiPath(pathname: string): boolean {
  return (
    // Auth flow — must be reachable without an existing session
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/2fa") ||
    pathname.startsWith("/api/auth/sessions") ||
    pathname.startsWith("/api/auth/forgot-password") ||
    pathname.startsWith("/api/auth/reset-password") ||
    pathname.startsWith("/api/auth/signup") ||
    // Webhooks — signature is their auth, no session
    pathname.startsWith("/api/webhooks") ||
    // Cron jobs — Vercel-signed token in headers
    pathname.startsWith("/api/cron") ||
    // Public per-token / per-tracking-id endpoints
    pathname.startsWith("/api/tracking") ||
    pathname.startsWith("/api/bespoke/approval-response") ||
    pathname.startsWith("/api/bespoke/approval-validate") ||
    pathname.startsWith("/api/contact") ||
    // Stripe checkout (signup-time, no session yet)
    pathname.startsWith("/api/stripe") ||
    // Health + sandbox introspection
    pathname.startsWith("/api/health") ||
    // Demo session route (returns 410 — see api/demo/session/route.ts)
    pathname.startsWith("/api/demo")
  );
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/track") ||
    // Customer-facing approval flow (bespoke). /approve/[token] is the
    // canonical path; /bespoke/approve/[token] is the compatibility alias
    // for old bookmarks / hand-typed URLs. Both are per-token public pages
    // — auth middleware must not redirect them to /login or the customer
    // gets dumped on the staff login form.
    pathname.startsWith("/approve") ||
    pathname.startsWith("/bespoke/approve") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/support-access") ||
    pathname.startsWith("/_next") ||
    isAlwaysPublicApiPath(pathname) ||
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

// Tenant-prefixed routes that ALSO have a matching (shop)/[subdomain]/<route>
// public page. For these, an unauth visitor on /{slug}/<route> must be allowed
// through so Next.js serves the public shop version instead of being redirected
// to /login. An authed jeweller on the same URL still gets the admin rewrite
// to the flat /<route> (app) route, preserving bookmarkable tenant URLs.
const PUBLIC_SHOP_TENANT_ROUTES = new Set(["repairs"]);

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
    // PR-05: /admin is the super-admin surface — the AAL2 gate matters
    // most here. totp_enabled is read from the shell cookie (set at login
    // + signed) so we skip the users-table round-trip on every /admin nav.
    const adminProfile = await resolveMiddlewareProfile(request, user.id);
    const twoFactorRedirectAdmin = await enforceTwoFactor(
      request,
      user.id,
      adminProfile?.totp_enabled,
      supabaseResponse
    );
    if (twoFactorRedirectAdmin) return twoFactorRedirectAdmin;
    return supabaseResponse;
  }

  // --- Tenant-slug URL routing: /{slug}/{route} ---
  // Validates the slug matches the authenticated user's tenant, sets AUTH headers,
  // and rewrites internally to the flat /{route} so page components need zero changes.
  const tenantParsed = parseTenantSlugPath(pathname);
  if (tenantParsed !== null) {
    if (!user) {
      // Routes with a public (shop)/[subdomain]/<route> page must not redirect
      // unauth visitors to /login — they're intended to render the jeweller's
      // public shop. Currently only /repairs needs this bridge (catalogue,
      // enquiry, appointments, track are already absent from TENANT_APP_ROUTES
      // so they pass through naturally). Pass through without rewriting so
      // Next.js matches the (shop) group for this URL.
      if (PUBLIC_SHOP_TENANT_ROUTES.has(tenantParsed.route.slice(1))) {
        return supabaseResponse;
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return redirectWithCookies(loginUrl, supabaseResponse);
    }
    if (!user.email_confirmed_at) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-email";
      return redirectWithCookies(verifyUrl, supabaseResponse);
    }

    const userProfile = await resolveMiddlewareProfile(request, user.id);
    if (!userProfile || !userProfile.tenant_id) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return redirectWithCookies(onboardingUrl, supabaseResponse);
    }

    // PR-05: gate tenant-slug routes behind the AAL2 cookie when the user
    // has 2FA enabled. Exempt paths (/verify-2fa itself, /api/auth/2fa/**)
    // are handled inside enforceTwoFactor.
    const twoFactorRedirect = await enforceTwoFactor(
      request,
      user.id,
      userProfile.totp_enabled,
      supabaseResponse
    );
    if (twoFactorRedirect) return twoFactorRedirect;

    const userTenantSlug = userProfile.slug;
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

  // Any flat /{route} where the first segment is a known app route needs
  // auth redirect in middleware — otherwise the (app) layout streams its
  // nav shell before the page's async auth guard throws NEXT_REDIRECT,
  // giving unauth users a ~1s flash of the app chrome before /login.
  // Using TENANT_APP_ROUTES as the single source of truth also covers
  // /tasks, /workshop, /financials, /notifications, /integrations, etc.
  // (routes previously missed by the hand-rolled startsWith chain).
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const isProtectedRoute = !!firstSegment && TENANT_APP_ROUTES.has(firstSegment);

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

    const userProfile = await resolveMiddlewareProfile(request, user.id);
    if (!userProfile || !userProfile.tenant_id) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return redirectWithCookies(onboardingUrl, supabaseResponse);
    }

    // PR-05: same AAL2 gate for the flat-route branch. Exempt paths
    // (/verify-2fa, /api/auth/2fa/**, /api/auth/logout, /logout) are
    // checked inside enforceTwoFactor. Note that most /api routes go
    // through isPublicPath() above and never reach this branch — but
    // protected app routes (/dashboard, /inventory, /settings, …) do.
    const twoFactorRedirectFlat = await enforceTwoFactor(
      request,
      user.id,
      userProfile.totp_enabled,
      supabaseResponse
    );
    if (twoFactorRedirectFlat) return twoFactorRedirectFlat;

    // Migrate flat URLs — tenant-aware URLs for bookmarkable, shareable routes.
    // Tenants with a slug get redirected; tenants without a slug fall through to flat-route mode.
    const userTenantSlug = userProfile.slug;
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
