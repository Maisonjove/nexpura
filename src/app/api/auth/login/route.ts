import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/login
 *
 * Route Handler for email/password auth.
 *
 * Returns a redirect on success (mirrors /auth/confirm pattern) so that session
 * cookies set via cookies().set() are included in the response's Set-Cookie headers.
 * Returning NextResponse.json() does not reliably propagate those cookies.
 *
 * On auth failure: returns JSON { error } with status 401.
 * On 2FA required: returns JSON { requires2FA, userId, email } with status 200.
 * On success: redirects to the requested destination (defaults to /dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, redirectTo } = body as { email: string; password: string; redirectTo?: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Check 2FA
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("totp_enabled")
      .eq("id", data.user.id)
      .single();

    if (profile?.totp_enabled) {
      return NextResponse.json({
        requires2FA: true,
        userId: data.user.id,
        email: data.user.email,
      });
    }

    // Success — redirect. Session cookies are set by createClient() above and will
    // be included in this redirect response's Set-Cookie headers automatically.
    const destination = redirectTo || "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
