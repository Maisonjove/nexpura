import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // Run base session update
  const response = await updateSession(request);

  const pathname = request.nextUrl.pathname;

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
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
