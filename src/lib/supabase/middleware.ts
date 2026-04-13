import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import logger from "@/lib/logger";
import { AUTH_HEADERS, getCachedUserProfile } from "@/lib/cached-auth";

export async function updateSession(request: NextRequest) {
  // Top-level guard: if anything in this function throws (Edge Runtime limits,
  // Supabase network failure, etc.) redirect to /login for protected routes
  // rather than silently passing through unauthenticated.
  try {
    return await _updateSessionInner(request);
  } catch (err) {
    logger.error("[middleware] updateSession threw:", err);
    const { pathname } = request.nextUrl;
    const isPublicRoute =
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
      pathname.includes(".");
    if (!isPublicRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }
}

async function _updateSessionInner(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const pathname = request.nextUrl.pathname;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
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

  // Refresh / validate session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes -- no auth required
  const isPublicRoute =
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
    pathname.includes(".");

  if (isPublicRoute) {
    return supabaseResponse;
  }

  // /verify-email -- public waiting page (must be exempt before auth checks)
  if (pathname.startsWith("/verify-email")) {
    return supabaseResponse;
  }

  // /onboarding -- requires auth but NOT tenant
  const isOnboarding = pathname.startsWith("/onboarding");
  if (isOnboarding) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    // SECURITY: Block unverified users from onboarding actions too
    if (!user.email_confirmed_at) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-email";
      return NextResponse.redirect(verifyUrl);
    }
    return supabaseResponse;
  }

  // /admin routes -- requires auth + super_admin check (handled in page)
  const isAdminRoute = pathname.startsWith("/admin");
  if (isAdminRoute) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // Protected app routes -- require auth AND tenant
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
      return NextResponse.redirect(loginUrl);
    }

    // SECURITY: Block unverified users from ALL protected routes.
    if (!user.email_confirmed_at) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-email";
      return NextResponse.redirect(verifyUrl);
    }

    // Use cached user profile (Redis, 5-min TTL) instead of direct DB call
    const userProfile = await getCachedUserProfile(user.id);
    if (!userProfile || !userProfile.tenant_id) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return NextResponse.redirect(onboardingUrl);
    }

    // ── Performance: forward auth data on the REQUEST so AppLayout can read it
    // via headers() without making a second supabase.auth.getUser() call.
    // Setting headers on the response (supabaseResponse.headers.set) sends them
    // to the browser -- they are NOT visible to server components via headers().
    // Using NextResponse.next({ request: { headers } }) is the correct pattern.
    const authRequestHeaders = new Headers(request.headers);
    authRequestHeaders.set(AUTH_HEADERS.USER_ID, user.id);
    authRequestHeaders.set(AUTH_HEADERS.TENANT_ID, userProfile.tenant_id);
    authRequestHeaders.set(AUTH_HEADERS.USER_ROLE, userProfile.role || "");
    authRequestHeaders.set(AUTH_HEADERS.USER_EMAIL, user.email || "");

    // Build the final response that forwards auth headers to the page handler
    const authResponse = NextResponse.next({
      request: { headers: authRequestHeaders },
    });

    // Transfer all session cookies from the Supabase response.
    // supabaseResponse.cookies.getAll() returns full ResponseCookie objects
    // including httpOnly, secure, sameSite, maxAge, etc. -- all are preserved.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      authResponse.cookies.set(cookie);
    });

    // Subscription gate: skip billing and suspended pages
    if (
      !pathname.startsWith("/billing") &&
      !pathname.startsWith("/suspended")
    ) {
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
          sub.status === "suspended" ||
          isTrialExpired ||
          isCancelledAndExpired;

        if (isBlocked) {
          const suspendedUrl = request.nextUrl.clone();
          suspendedUrl.pathname = "/suspended";
          return NextResponse.redirect(suspendedUrl);
        }
      }
    }

    return authResponse;
  }

  return supabaseResponse;
}
