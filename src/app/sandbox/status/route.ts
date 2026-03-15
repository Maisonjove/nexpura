/**
 * /sandbox/status?rt=nexpura-review-2026 — Sandbox health check
 *
 * With the middleware-injection approach, this route works without any browser
 * cookie persistence. The ?rt= param causes the middleware to inject the demo
 * session into the request, so cookies() here returns the demo session.
 *
 * Usage: GET /sandbox/status?rt=nexpura-review-2026
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEMO_USER_ID = "bd7d2c20-5727-4f80-a449-818429abecc9";
const REVIEW_TOKEN = "nexpura-review-2026";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Check if review token was supplied (middleware will have injected the session)
  const rtParam = request.nextUrl.searchParams.get("rt");
  const hasToken = rtParam === REVIEW_TOKEN;

  // Read cookies — middleware has already injected demo session cookies here
  // if the ?rt= param was present on this request
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const authCookies = allCookies
    .filter((c) => c.name.includes("sb-") && c.name.includes("auth"))
    .map((c) => c.name);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) {
    return NextResponse.json(
      {
        authenticated: false,
        sandboxReady: false,
        message: hasToken
          ? "Session injection failed — check server logs."
          : "No review token. Use: /sandbox/status?rt=nexpura-review-2026",
        correctUrl: "/sandbox/status?rt=nexpura-review-2026",
        debug: {
          rtProvided: !!rtParam,
          rtValid: hasToken,
          authCookiesInjected: authCookies,
          totalCookies: allCookies.length,
          error: error?.message ?? null,
        },
      },
      { status: 401 }
    );
  }

  const isCorrectUser = user.id === DEMO_USER_ID;
  const admin = createAdminClient();

  const [{ data: tenant }, { data: userRecord }] = await Promise.all([
    admin
      .from("tenants")
      .select("name, slug, business_name")
      .eq("id", TENANT_ID)
      .single(),
    admin.from("users").select("role, full_name").eq("id", user.id).single(),
  ]);

  return NextResponse.json({
    authenticated: true,
    sandboxReady: isCorrectUser,
    user: {
      id: user.id,
      email: user.email,
      name: userRecord?.full_name ?? "Demo Owner",
      role: userRecord?.role ?? "owner",
    },
    tenant: {
      id: TENANT_ID,
      name: tenant?.name ?? "Marcus & Co. Fine Jewellery",
      businessName: tenant?.business_name ?? "Marcus & Co. Fine Jewellery",
      slug: tenant?.slug ?? "marcusco",
    },
    access: "read-write",
    mechanism: "middleware session injection (cookie-free)",
    isolation: "seeded demo tenant only — no other tenant data accessible",
    urls: {
      entry: "/sandbox",
      directEntry: `/dashboard?rt=${REVIEW_TOKEN}`,
      reset: `/sandbox/reset`,
      status: `/sandbox/status?rt=${REVIEW_TOKEN}`,
    },
  });
}
