/**
 * /sandbox/status — Sandbox health check
 *
 * Returns JSON confirming whether the reviewer has an active authenticated session.
 * Also shows which auth cookies are present to help diagnose issues.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEMO_USER_ID = "bd7d2c20-5727-4f80-a449-818429abecc9";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Check which Supabase auth cookies are present (for diagnostics)
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
        setAll() {
          // Read-only for status check
        },
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
        message: "No active session. Visit /sandbox to enter the demo sandbox.",
        entry: "/sandbox",
        debug: {
          authCookiesPresent: authCookies,
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
    isolation: "seeded demo tenant only — no other tenant data accessible",
    urls: {
      entry: "/sandbox",
      reset: "/sandbox/reset",
      status: "/sandbox/status",
      app: "/",
    },
  });
}
