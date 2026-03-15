import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  // Refresh session — must await getUser() to keep session fresh
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes — no auth required
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/demo") || // Demo mode — public read-only preview
    pathname.startsWith("/review") || // Review mode — public read-only routes
    pathname.startsWith("/sandbox") || // Sandbox — public demo tenant access
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
    pathname.startsWith("/ai");

  if (isProtectedRoute) {
    // Must be authenticated
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    // Check if user has a tenant record
    const { data: userRecord } = await supabase
      .from("users")
      .select("id, tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!userRecord || !userRecord.tenant_id) {
      // No tenant — redirect to onboarding
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return NextResponse.redirect(onboardingUrl);
    }

    // Check for suspended subscription if not on /billing or /suspended
    if (!pathname.startsWith("/billing") && !pathname.startsWith("/suspended")) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("tenant_id", userRecord.tenant_id)
        .maybeSingle();

      if (sub?.status === "suspended") {
        const suspendedUrl = request.nextUrl.clone();
        suspendedUrl.pathname = "/suspended";
        return NextResponse.redirect(suspendedUrl);
      }
    }
  }

  return supabaseResponse;
}
