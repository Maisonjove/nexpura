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
 * Called after the client-side signInWithPassword succeeds.
 */
export async function postLoginChecks(
  userId: string,
  userEmail: string,
  accessToken: string,
  identifier: string
): Promise<LoginResult> {
  try {
    const clientHeaders = await getClientHeaders();
    const admin = createAdminClient();

    const [, profileResult] = await Promise.all([
      clearLoginAttempts(identifier).catch(() => {}),
      admin.from("users").select("totp_enabled").eq("id", userId).single(),
    ]);

    // Pre-warm Redis cache
    getCachedUserProfile(userId).catch(() => {});

    if (profileResult.data?.totp_enabled) {
      return { success: true, requires2FA: true, userId, email: userEmail };
    }

    // Non-blocking session recording
    recordSession(userId, accessToken, clientHeaders).catch(() => {});
    checkNewDeviceLogin(userId, userEmail, clientHeaders).catch(() => {});

    return { success: true };
  } catch {
    // Post-login checks failing should never block the user from logging in
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
