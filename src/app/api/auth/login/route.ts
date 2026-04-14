import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/login
 *
 * Route Handler for email/password auth. Using a Route Handler (not a Server Action)
 * ensures that the Supabase session cookies are set via HTTP Set-Cookie headers in the
 * response, which is the only approach that reliably propagates auth cookies in
 * Next.js App Router regardless of caching or RSC navigation.
 *
 * Returns JSON: { ok: true } on success, { error: string } on failure.
 * The client handles navigation after receiving { ok: true }.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Session cookies are set automatically by the server Supabase client
    // (via the cookieStore.set() calls triggered by auth state change).
    // Return success — the client will navigate to /dashboard.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
