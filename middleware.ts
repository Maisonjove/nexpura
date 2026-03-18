import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getSubdomain, getTenantBySlug } from "@/lib/subdomain";
import { createAdminClient } from "@/lib/supabase/admin";

export async function middleware(request: NextRequest) {
  // Top-level guard: if anything throws, pass through instead of returning 500
  try {
    return await _proxyInner(request);
  } catch (err) {
    console.error("[middleware] threw — passing through:", err);
    return NextResponse.next();
  }
}

async function _proxyInner(request: NextRequest) {
  // ── Subdomain tenant routing: acme.nexpura.com → inject x-subdomain-tenant-id ──
  // This runs BEFORE review/staff mode and BEFORE auth checks.
  // It only injects a header — it never overrides auth, RLS, or review mode.
  const host = request.headers.get("host") ?? "";
  const subdomain = getSubdomain(host);
  if (subdomain) {
    try {
      const tenantId = await getTenantBySlug(subdomain, createAdminClient());
      if (tenantId) {
        // Clone headers and inject the subdomain tenant context
        const subdomainHeaders = new Headers(request.headers);
        subdomainHeaders.set("x-subdomain-tenant-id", tenantId);
        subdomainHeaders.set("x-subdomain-slug", subdomain);
        // Re-enter proxy with the enriched request so review/auth logic still runs
        const enrichedRequest = new NextRequest(request.url, {
          headers: subdomainHeaders,
          method: request.method,
          body: request.body,
        });
        // Continue through the rest of _proxyInner with enriched headers
        // by falling through — but we need to rebuild the response with headers.
        // Instead: return NextResponse.next with the modified request headers
        // so pages can read x-subdomain-tenant-id via headers().
        // Auth + subscription checks still apply via updateSession below.
        const response = await updateSession(enrichedRequest);
        const pathname = enrichedRequest.nextUrl.pathname;

        // Review/staff tokens are still honoured via updateSession above
        const REVIEW_TOKEN = "nexpura-review-2026";
        const STAFF_TOKEN = "nexpura-staff-2026";
        const rtParam = enrichedRequest.nextUrl.searchParams.get("rt");
        const reviewCookie = enrichedRequest.cookies.get("nexpura-review")?.value;
        const staffCookie = enrichedRequest.cookies.get("nexpura-staff")?.value;
        if (
          rtParam === REVIEW_TOKEN || reviewCookie === REVIEW_TOKEN ||
          rtParam === STAFF_TOKEN  || staffCookie  === STAFF_TOKEN
        ) {
          return response;
        }

        // Exempt routes pass through directly
        const isExempt =
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
          pathname.includes(".");

        if (isExempt) return response;

        // For protected routes, check subscription — pass through on any error
        try {
          const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll() { return enrichedRequest.cookies.getAll(); },
                setAll(cookiesToSet) {
                  cookiesToSet.forEach(({ name, value }) => enrichedRequest.cookies.set(name, value));
                },
              },
            }
          );
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return response;
          const { data: userData } = await supabase.from("users").select("tenant_id").eq("id", user.id).single();
          if (!userData?.tenant_id) return response;
          const { data: subscription } = await supabase.from("subscriptions").select("status").eq("tenant_id", userData.tenant_id).single();
          if (subscription?.status === "suspended" || subscription?.status === "payment_required") {
            const billingUrl = enrichedRequest.nextUrl.clone();
            billingUrl.pathname = "/billing";
            return NextResponse.redirect(billingUrl);
          }
        } catch {
          // pass through on error
        }
        return response;
      }
    } catch (err) {
      console.error("[proxy] subdomain lookup failed:", err);
      // Fall through to normal request handling
    }
  }

  // Run base session update
  const response = await updateSession(request);

  const pathname = request.nextUrl.pathname;

  // ── Review / staff mode — skip ALL subscription checks ───────────────────
  // Sandbox sessions have no subscription record and must never hit the users
  // table via the anon-key RLS client (causes recursion → hang → 500).
  const REVIEW_TOKEN = "nexpura-review-2026";
  const STAFF_TOKEN = "nexpura-staff-2026";
  const rtParam = request.nextUrl.searchParams.get("rt");
  const reviewCookie = request.cookies.get("nexpura-review")?.value;
  const staffCookie = request.cookies.get("nexpura-staff")?.value;
  if (
    rtParam === REVIEW_TOKEN || reviewCookie === REVIEW_TOKEN ||
    rtParam === STAFF_TOKEN  || staffCookie  === STAFF_TOKEN
  ) {
    return response;
  }

  // Skip suspension check for public/auth/billing/api routes
  const isExempt =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/billing") ||
    pathname.includes(".");

  if (isExempt) {
    return response;
  }

  // For protected app routes, check subscription status
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
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return response;
  }

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return response;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (
    subscription?.status === "suspended" ||
    subscription?.status === "payment_required"
  ) {
    const billingUrl = request.nextUrl.clone();
    billingUrl.pathname = "/billing";
    return NextResponse.redirect(billingUrl);
  }

  return response;
} // end _proxyInner

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// Next.js middleware entry point — must have a default export
export default middleware;
