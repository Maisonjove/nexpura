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
    const { email, password, redirectTo, checkOnly2FA, userId: clientUserId } = body as { email: string; password: string; redirectTo?: string; checkOnly2FA?: boolean; userId?: string };

    // Handle 2FA-only check (client already authenticated via client-side
    // signInWithPassword). Historically this path called
    // admin.auth.admin.listUsers() to resolve email→userId before querying
    // totp_enabled — a single-row lookup wrapped in a full-project user list
    // that scales O(project users) and costs ~100-500ms.
    //
    // Fast path: the client already has `data.user.id` from its own
    // signInWithPassword response — pass it in the request body and we skip
    // listUsers entirely, going straight to the single users-table query.
    //
    // Safety: verify clientUserId matches the authenticated session user
    // before trusting it, so a malicious client can't ask about someone
    // else's totp_enabled flag. (This matches the pattern already used by
    // /api/auth/2fa/validate.) Even if this check somehow returned the wrong
    // answer, it could not bypass 2FA — the actual TOTP code validation at
    // /api/auth/2fa/validate separately enforces that the submitted userId
    // matches the session.
    if (checkOnly2FA) {
      const admin = createAdminClient();

      // Fast path: client passed its own userId
      if (clientUserId) {
        const supabase = await createClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();
        if (!sessionUser || sessionUser.id !== clientUserId) {
          // Session doesn't match — don't trust the supplied userId. Fall
          // through to the email path below (or return a safe default).
        } else {
          const { data: profile } = await admin
            .from("users")
            .select("totp_enabled")
            .eq("id", clientUserId)
            .single();
          if (profile?.totp_enabled) {
            return NextResponse.json({ requires2FA: true, userId: clientUserId, email: sessionUser.email });
          }
          return NextResponse.json({ requires2FA: false });
        }
      }

      // Slow fallback path: no userId supplied, look up by email.
      if (!email) {
        return NextResponse.json({ requires2FA: false });
      }
      const { data: userData } = await admin.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email === email);
      if (user) {
        const { data: profile } = await admin.from("users").select("totp_enabled").eq("id", user.id).single();
        if (profile?.totp_enabled) {
          return NextResponse.json({ requires2FA: true, userId: user.id, email: user.email });
        }
      }
      return NextResponse.json({ requires2FA: false });
    }

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
