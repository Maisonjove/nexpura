import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import logger from "@/lib/logger";

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
      pathname.startsWith("/track") || // Public order tracking page
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

  // ── Route authorization ──────────────────────────────────────────────────────────
  // Public routes — no auth required
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/track") || // Public order tracking page
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/support-access") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".");

  if (isPublicRoute) {
    return supabaseResponse;
  }

  // /onboarding — requires auth but NOT tenant
  const isOnboarding = pathname.startsWith("/onboarding");
  if (isOnboarding) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // /admin routes — requires auth + super_admin check (handled in page)
  const isAdminRoute = pathname.startsWith("/admin");
  if (isAdminRoute) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // Protected app routes — require auth AND tenant
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
    pathname.startsWith("/ai");

  if (isProtectedRoute) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    const { data: userRecord } = await supabase
      .from("users")
      .select("id, tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!userRecord || !userRecord.tenant_id) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return NextResponse.redirect(onboardingUrl);
    }

    // Check subscription status (skip for billing/suspended pages)
    if (!pathname.startsWith("/billing") && !pathname.startsWith("/suspended")) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, current_period_end, trial_ends_at")
        .eq("tenant_id", userRecord.tenant_id)
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
          return NextResponse.redirect(suspendedUrl);
        }
      }
    }
  }

  return supabaseResponse;
}
