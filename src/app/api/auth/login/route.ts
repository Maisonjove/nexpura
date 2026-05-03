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
import {
  signShellCookie,
  SHELL_COOKIE_NAME,
  SHELL_COOKIE_MAX_AGE,
} from "@/lib/dashboard/shell-cookie";
import { isAllowlistedAdmin } from "@/lib/admin-allowlist";
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

    // The legacy `checkOnly2FA` pre-auth probe was removed. It returned
    // `{requires2FA: true, userId, email}` for any registered account
    // with TOTP enabled, which was an unauthenticated enumeration oracle
    // (plus a full listUsers() scan per probe on the email branch).
    // The `requires2FA` signal is now delivered only after successful
    // password auth further down, so the probe isn't needed. Requests
    // that still send `checkOnly2FA:true` are rejected with the same
    // generic 400 as any malformed body.
    if (checkOnly2FA) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 },
      );
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
    //
    // Also: widen the tenant select so we can populate the
    // `nexpura-dash-shell` cookie in one go — dashboard will read it
    // and skip its DB round-trip on the first cold render.
    // ─────────────────────────────────────────────────────────────
    const admin = createAdminClient();
    // Joey 2026-05-03: switched tenants!inner → tenants (left join). The
    // allowlisted-admin (germanijoey@yahoo.com) now has tenant_id=NULL
    // post tenant-consolidation migration, and an inner join with
    // .single() would have failed for that user — locking him out of
    // the platform. The left-join still returns the row (with
    // tenants=null) and the no-tenant branch below routes him to /admin.
    const { data: profile } = await admin
      .from("users")
      .select(
        "totp_enabled, tenant_id, role, tenants(slug, name, business_name, business_type, currency, timezone)",
      )
      .eq("id", data.user.id)
      .maybeSingle();

    const profileTyped = profile as {
      totp_enabled?: boolean;
      tenant_id?: string | null;
      role?: string;
      tenants?: {
        slug?: string | null;
        name?: string | null;
        business_name?: string | null;
        business_type?: string | null;
        currency?: string | null;
        timezone?: string | null;
      } | null;
    } | null;

    // Build + sign the shell cookie. Fire-and-forget: if signing fails
    // (missing secret, Edge crypto transient) the dashboard just falls
    // back to its DB path. We set the cookie on BOTH the requires2FA
    // path and the success path so a subsequent /verify-2fa → /dashboard
    // hit reads it without a round-trip.
    const shellCookieValue = await signShellCookie({
      userId: data.user.id,
      tenantId: profileTyped?.tenant_id ?? "",
      firstName: profileTyped?.tenants?.business_name || profileTyped?.tenants?.name || "there",
      tenantName: profileTyped?.tenants?.business_name || profileTyped?.tenants?.name || null,
      businessType: profileTyped?.tenants?.business_type ?? null,
      currency: profileTyped?.tenants?.currency || "AUD",
      timezone: profileTyped?.tenants?.timezone ?? null,
      isManager: profileTyped?.role === "owner" || profileTyped?.role === "manager",
      // Middleware fast-path fields — lets subsequent navigations skip
      // the users+tenants DB read that getCachedUserProfile currently
      // does on every protected nav.
      role: profileTyped?.role ?? undefined,
      tenantSlug: profileTyped?.tenants?.slug ?? null,
      totpEnabled: profileTyped?.totp_enabled === true,
    }).catch(() => null);

    function attachShellCookie(res: NextResponse): NextResponse {
      if (!shellCookieValue) return res;
      res.cookies.set(SHELL_COOKIE_NAME, shellCookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SHELL_COOKIE_MAX_AGE,
      });
      return res;
    }

    if (profileTyped?.totp_enabled) {
      return attachShellCookie(
        NextResponse.json({
          requires2FA: true,
          userId: data.user.id,
          email: data.user.email,
        }),
      );
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
    const tenantSlug = profileTyped?.tenants?.slug ?? null;

    // Joey 2026-05-03: platform-admin routing. germanijoey@yahoo.com is
    // the only allowlisted admin and post tenant-consolidation has
    // tenant_id=NULL — they belong on /admin, not the tenant
    // /{slug}/dashboard path. Belt-and-suspenders: middleware enforces
    // the same gate so a stale `redirectTo` querystring couldn't bypass.
    if (isAllowlistedAdmin(data.user.email) && !profileTyped?.tenant_id) {
      return attachShellCookie(
        NextResponse.json({
          success: true,
          redirectTo: "/admin",
          tenantSlug: null,
        }),
      );
    }

    return attachShellCookie(
      NextResponse.json({
        success: true,
        redirectTo: redirectTo || "/dashboard",
        tenantSlug,
      }),
    );
  } catch (err) {
    logger.error("[api/auth/login] unexpected error", { error: err });
    // Enumeration-safe fallback: same copy as invalid-credentials.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
}
