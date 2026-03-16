import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Preview-only sandbox review mode ─────────────────────────────────────────
// Tokens are hardcoded (preview-only; not production). Remove this block after review.
const REVIEW_TOKEN = "nexpura-review-2026";
const REVIEW_COOKIE = "nexpura-review";
const STAFF_TOKEN = "nexpura-staff-2026";
const STAFF_COOKIE = "nexpura-staff";

// Module-level session cache — persists for the lifetime of the process instance.
// Each Vercel edge worker instance caches its own session; falls back to sign-in on cold start.
let _cachedDemoCookies: Array<{ name: string; value: string }> | null = null;
let _cacheExpiresAt = 0;
let _cachedStaffCookies: Array<{ name: string; value: string }> | null = null;
let _staffCacheExpiresAt = 0;

async function getDemoSessionCookies(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<Array<{ name: string; value: string }>> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached session if still valid (with 5-minute buffer)
  if (_cachedDemoCookies && _cacheExpiresAt > now + 300) {
    return _cachedDemoCookies;
  }

  // Sign in as demo user using a temporary in-memory client.
  // Capture the cookies @supabase/ssr would set — this gives us the correct format.
  const captured: Array<{ name: string; value: string }> = [];

  const tmpClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cs) {
        captured.push(...cs.map((c) => ({ name: c.name, value: c.value })));
      },
    },
  });

  // Retry up to 2 times on transient Supabase auth failures (cold-start protection)
  let session = null;
  let error = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await tmpClient.auth.signInWithPassword({
      email: "demo@nexpura.com",
      password: "nexpura-demo-2026",
    });
    session = result.data.session;
    error = result.error;
    if (session) break;
    if (attempt < 1) await new Promise((r) => setTimeout(r, 300));
  }

  if (error || !session) {
    console.error("[sandbox] Demo session fetch failed after retries:", error?.message);
    return [];
  }

  _cachedDemoCookies = captured;
  _cacheExpiresAt = session.expires_at ?? now + 3600;
  return _cachedDemoCookies;
}

async function getStaffSessionCookies(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<Array<{ name: string; value: string }>> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached session if still valid (with 5-minute buffer)
  if (_cachedStaffCookies && _staffCacheExpiresAt > now + 300) {
    return _cachedStaffCookies;
  }

  // Sign in as staff user using a temporary in-memory client.
  const captured: Array<{ name: string; value: string }> = [];

  const tmpClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cs) {
        captured.push(...cs.map((c) => ({ name: c.name, value: c.value })));
      },
    },
  });

  let session = null;
  let error = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await tmpClient.auth.signInWithPassword({
      email: "staff@nexpura.com",
      password: "nexpura-staff-2026",
    });
    session = result.data.session;
    error = result.error;
    if (session) break;
    if (attempt < 1) await new Promise((r) => setTimeout(r, 300));
  }

  if (error || !session) {
    console.error("[sandbox] Staff session fetch failed after retries:", error?.message);
    return [];
  }

  _cachedStaffCookies = captured;
  _staffCacheExpiresAt = session.expires_at ?? now + 3600;
  return _cachedStaffCookies;
}
// ─────────────────────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const pathname = request.nextUrl.pathname;

  // ── Review-mode detection ─────────────────────────────────────────────────
  const rtParam = request.nextUrl.searchParams.get("rt");
  const reviewCookieValue = request.cookies.get(REVIEW_COOKIE)?.value;
  const staffCookieValue = request.cookies.get(STAFF_COOKIE)?.value;
  const isReviewRequest =
    rtParam === REVIEW_TOKEN || reviewCookieValue === REVIEW_TOKEN;
  const isStaffRequest =
    rtParam === STAFF_TOKEN || staffCookieValue === STAFF_TOKEN;

  // ── Build request headers — inject session if review/staff mode ────────────
  // This is the core of the cookie-free approach: we modify the Cookie header
  // on the forwarded request. Server Components read cookies via await cookies()
  // from next/headers, which reads from the forwarded request headers.
  // So injecting here makes the session visible to ALL Server Components
  // without requiring the browser to store or send any Supabase auth cookies.
  const requestHeaders = new Headers(request.headers);
  let demoCookies: Array<{ name: string; value: string }> = [];

  if (isStaffRequest) {
    demoCookies = await getStaffSessionCookies(supabaseUrl, supabaseAnonKey);
  } else if (isReviewRequest) {
    demoCookies = await getDemoSessionCookies(supabaseUrl, supabaseAnonKey);
  }

  if (demoCookies.length > 0) {
    const existingCookieHeader = requestHeaders.get("cookie") ?? "";
    const demoCookieStr = demoCookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    // Merge: session cookies take precedence (appended, @supabase/ssr reads last-wins)
    requestHeaders.set(
      "cookie",
      existingCookieHeader
        ? `${existingCookieHeader}; ${demoCookieStr}`
        : demoCookieStr
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Initial supabase response — uses modified request headers so Server Components
  // receive the injected session cookies via await cookies()
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  // The middleware's own Supabase client reads the merged cookies
  // (existing browser cookies + injected session if review/staff mode)
  const mergedCookies = [
    ...request.cookies
      .getAll()
      .filter((c) => !demoCookies.find((d) => d.name === c.name)),
    ...demoCookies,
  ];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return mergedCookies;
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        // Preserve the modified requestHeaders when rebuilding supabaseResponse
        supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
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

  // Persist the review/staff mode cookie on the response.
  // Simple non-httpOnly cookie — much easier to retain across navigations than
  // large Supabase auth tokens. Enables navigation within the app without ?rt= param.
  if (isStaffRequest) {
    supabaseResponse.cookies.set(STAFF_COOKIE, STAFF_TOKEN, {
      path: "/",
      maxAge: 86400 * 7, // 7 days
      sameSite: "lax",
      httpOnly: false,
    });
  } else if (isReviewRequest) {
    supabaseResponse.cookies.set(REVIEW_COOKIE, REVIEW_TOKEN, {
      path: "/",
      maxAge: 86400 * 7, // 7 days
      sameSite: "lax",
      httpOnly: false,
    });
  }

  // ── Persist actual Supabase session cookies to browser ────────────────────
  // Root cause of intermittent 500s: Vercel runs multiple worker instances, each
  // with its own module-level session cache. When a request hits a cold instance,
  // the cache is empty and sign-in must happen again. If it fails under load,
  // no session cookies are injected and routes crash.
  //
  // Fix: explicitly write the demo/staff Supabase session cookies onto the
  // response Set-Cookie header so the BROWSER carries them. Subsequent requests
  // from the same browser will include the valid auth cookies directly —
  // the middleware then reads them from the request and skips the sign-in entirely.
  if (demoCookies.length > 0) {
    demoCookies.forEach(({ name, value }) => {
      // Only write if not already set by supabase.auth.getUser() above
      if (!supabaseResponse.cookies.get(name)) {
        supabaseResponse.cookies.set(name, value, {
          path: "/",
          maxAge: 3600, // 1 hour — matches Supabase JWT TTL
          sameSite: "lax",
          httpOnly: true,
        });
      }
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Route authorization ───────────────────────────────────────────────────

  // Public routes — no auth required
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/sandbox") ||
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
    // ── Review / staff sandbox: session already injected above — skip DB checks ─
    // The users table RLS policy can cause recursion when queried with the anon key.
    // For sandbox mode we know the session is valid (we just injected it), so there
    // is no need to re-validate via DB. Return immediately to avoid the hang.
    if (isReviewRequest || isStaffRequest) {
      return supabaseResponse;
    }

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
