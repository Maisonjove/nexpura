"use server";
// login actions

import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkLoginAttempts,
  recordFailedLogin,
  clearLoginAttempts,
} from "@/lib/auth-security";
import { recordSession, checkNewDeviceLogin } from "@/lib/session-manager";
import { getCachedUserProfile } from "@/lib/cached-auth";
import { headers } from "next/headers";

export type LoginResult = {
  success: boolean;
  error?: string;
  requires2FA?: boolean;
  userId?: string;
  email?: string;
  lockedUntil?: number;
};

async function getClientHeaders(): Promise<{ ip: string; userAgent: string }> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : headersList.get("x-real-ip") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";
  return { ip, userAgent };
}

/**
 * Pre-login security check: rate limiting only.
 * The actual signInWithPassword is done client-side (browser Supabase client)
 * so session cookies are written directly to document.cookie — reliable across
 * all Next.js deployment configurations.
 */
export async function checkLoginAllowed(
  email: string
): Promise<{ allowed: boolean; error?: string; lockedUntil?: number; identifier: string }> {
  try {
    const clientHeaders = await getClientHeaders();
    const identifier = `${email.toLowerCase()}:${clientHeaders.ip}`;
    const loginCheck = await checkLoginAttempts(identifier);
    if (!loginCheck.allowed) {
      const minutesRemaining = loginCheck.lockedUntil
        ? Math.ceil((loginCheck.lockedUntil - Date.now()) / 60000)
        : 15;
      return {
        allowed: false,
        error: `Too many failed attempts. Please try again in ${minutesRemaining} minutes.`,
        lockedUntil: loginCheck.lockedUntil,
        identifier,
      };
    }
    return { allowed: true, identifier };
  } catch {
    return { allowed: true, identifier: email };
  }
}

/**
 * Post-login server checks: 2FA status, session recording, cache warm-up.
 * Called after the Route Handler auth succeeds. Reads the session from cookies.
 */
export async function postLoginChecks(
  userEmail: string,
  identifier: string
): Promise<LoginResult> {
  try {
    const clientHeaders = await getClientHeaders();
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return { success: true };

    const admin = createAdminClient();
    const [, profileResult] = await Promise.all([
      clearLoginAttempts(identifier).catch(() => {}),
      admin.from("users").select("totp_enabled").eq("id", user.id).single(),
    ]);

    getCachedUserProfile(user.id).catch(() => {});

    if (profileResult.data?.totp_enabled) {
      return { success: true, requires2FA: true, userId: user.id, email: user.email };
    }

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (accessToken) {
      recordSession(user.id, accessToken, clientHeaders).catch(() => {});
      checkNewDeviceLogin(user.id, userEmail, clientHeaders).catch(() => {});
    }

    return { success: true };
  } catch {
    return { success: true };
  }
}

/**
 * Record a failed login attempt (called from client after signInWithPassword error).
 */
export async function recordFailedLoginAttempt(identifier: string): Promise<void> {
  try {
    await recordFailedLogin(identifier);
  } catch {
    // non-critical
  }
}
