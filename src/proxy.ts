import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // Top-level guard: if anything throws, pass through instead of returning 500
  try {
    return await _proxyInner(request);
  } catch (err) {
    console.error("[proxy] middleware threw — passing through:", err);
    return NextResponse.next();
  }
}

async function _proxyInner(request: NextRequest) {
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
export default proxy;
