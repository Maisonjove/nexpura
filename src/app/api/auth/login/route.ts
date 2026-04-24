import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  checkLoginAttempts,
  recordFailedLogin,
  clearLoginAttempts,
} from "@/lib/auth-security";
import { recordSession, checkNewDeviceLogin } from "@/lib/session-manager";
import logger from "@/lib/logger";

/**
 * POST /api/auth/login
 *
 * Server-side email/password auth.
 *
 * Previously the browser client called supabase.auth.signInWithPassword
 * directly, which meant the 5-strike lockout lived entirely on the
 * client — an attacker could skip `recordFailedLoginAttempt` or hit
 * Supabase auth directly and bypass it. This route is the single choke
 * point: rate limit, then login-attempt lockout, then Supabase auth.
 * The browser posts to this endpoint and never calls Supabase auth
 * itself.
 *
 * Enumeration-safe contract (preserved from the previous legacy impl):
 *   - auth failure → { error: "Invalid email or password" } @ 401
 *     (client renders the warmer "Those details don't match" copy)
 *   - email not confirmed → { error, code: "email_not_confirmed" } @ 403
 *   - lockout → { error, lockedUntil } @ 429
 *   - rate-limit → { error: "Too many requests" } @ 429
 *   - 2FA required → { requires2FA: true, userId, email } @ 200
 *   - success → { success: true, redirectTo } @ 200
 *
 * Session cookies are written via createClient() on success. Returning
 * JSON (not redirect) is deliberate — the client handles navigation so
 * it can prefetch the tenant-scoped dashboard URL.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, redirectTo, checkOnly2FA, userId: clientUserId } = body as {
      email: string;
      password: string;
      redirectTo?: string;
      checkOnly2FA?: boolean;
      userId?: string;
    };

    // ─────────────────────────────────────────────────────────────
    // 2FA-only check path (used after a session-authed user needs
    // to resolve totp_enabled). Preserved from the previous impl so
    // existing callers keep working.
    // ─────────────────────────────────────────────────────────────
    if (checkOnly2FA) {
      const admin = createAdminClient();

      if (clientUserId) {
        const supabase = await createClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();
        if (sessionUser && sessionUser.id === clientUserId) {
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

    const normalizedEmail = email.trim().toLowerCase();

    // ─────────────────────────────────────────────────────────────
    // Step 1: IP rate limit (broad throttle against high-volume guessing).
    // ─────────────────────────────────────────────────────────────
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "anonymous";
    const { success: rlOk } = await checkRateLimit(ip, "auth");
    if (!rlOk) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 },
      );
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2: per-(email+ip) 5-strike lockout. This is the gate a
    // client-side impl could previously bypass by just not calling
    // recordFailedLoginAttempt. Now enforced server-side before we
    // even hand the credentials to Supabase.
    // ─────────────────────────────────────────────────────────────
    const identifier = `${normalizedEmail}:${ip}`;
    const lockCheck = await checkLoginAttempts(identifier);
    if (!lockCheck.allowed) {
      const minutesRemaining = lockCheck.lockedUntil
        ? Math.ceil((lockCheck.lockedUntil - Date.now()) / 60000)
        : 15;
      return NextResponse.json(
        {
          error: `Too many failed attempts. Please try again in ${minutesRemaining} minutes.`,
          lockedUntil: lockCheck.lockedUntil,
        },
        { status: 429 },
      );
    }

    // ─────────────────────────────────────────────────────────────
    // Step 3: Supabase auth. The server client writes session cookies
    // onto the response that carries this JSON.
    // ─────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      // Record the failure server-side so the 5-strike counter is
      // authoritative and can't be skipped by a client.
      await recordFailedLogin(identifier).catch(() => {});

      // Surface the email-confirmation branch separately (Supabase
      // already sent a confirmation email proactively — this doesn't
      // leak account-existence any more than the signup flow does).
      const code = (error as { code?: string } | null)?.code ?? "";
      const msg = error?.message ?? "";
      if (code === "email_not_confirmed" || /email.*confirm/i.test(msg)) {
        return NextResponse.json(
          { error: "Please verify your email — check your inbox for the confirmation link.", code: "email_not_confirmed" },
          { status: 403 },
        );
      }

      // Enumeration-safe: the same copy for "invalid credentials" AND
      // the unknown-error fallback. The client renders the warmer
      // "Those details don't match — please check your email and
      // password and try again." copy from this single error string.
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    // Login succeeded — clear the strike counter.
    await clearLoginAttempts(identifier).catch(() => {});

    // ─────────────────────────────────────────────────────────────
    // Step 4: 2FA gate. Middleware will also bounce totp_enabled
    // users without the AAL2 cookie, but we return the signal here
    // so the client can take the user straight to /verify-2fa.
    // ─────────────────────────────────────────────────────────────
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("totp_enabled, tenant_id, tenants!inner(slug)")
      .eq("id", data.user.id)
      .single();

    if ((profile as { totp_enabled?: boolean } | null)?.totp_enabled) {
      return NextResponse.json({
        requires2FA: true,
        userId: data.user.id,
        email: data.user.email,
      });
    }

    // Session-tracking hooks (non-blocking).
    const userAgent = request.headers.get("user-agent") || "unknown";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (accessToken) {
        recordSession(data.user.id, accessToken, { ip, userAgent }).catch(() => {});
        checkNewDeviceLogin(data.user.id, data.user.email ?? normalizedEmail, { ip, userAgent }).catch(() => {});
      }
    } catch {
      // non-critical
    }

    // Resolve tenant slug so the client can skip the middleware
    // /dashboard → /{slug}/dashboard redirect round-trip on first nav.
    const tenantSlug = (profile as { tenants?: { slug?: string | null } } | null)?.tenants?.slug ?? null;

    return NextResponse.json({
      success: true,
      redirectTo: redirectTo || "/dashboard",
      tenantSlug,
    });
  } catch (err) {
    logger.error("[api/auth/login] unexpected error", { error: err });
    // Enumeration-safe fallback: same copy as invalid-credentials.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
}
