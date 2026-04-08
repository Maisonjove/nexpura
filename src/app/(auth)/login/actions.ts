"use server";
// login actions

import { createClient } from "@/lib/supabase/server";
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
  // Check various headers for client IP
  const forwardedFor = headersList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : headersList.get("x-real-ip") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";
  return { ip, userAgent };
}

export async function loginAction(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    // Parallelize initial setup - headers, rate limit check, and supabase client creation
    const [clientHeaders, supabase] = await Promise.all([
      getClientHeaders(),
      createClient(),
    ]);

    // SECURITY: Sign out any existing session before signing in as a new user.
    // Prevents one user's session from bleeding into another user's login flow.
    await supabase.auth.signOut();
    
    // Use a combination of email + IP for rate limiting
    // This prevents account enumeration while still protecting against distributed attacks
    const identifier = `${email.toLowerCase()}:${clientHeaders.ip}`;

  // Check if login attempts are allowed (must be before auth attempt)
  const loginCheck = await checkLoginAttempts(identifier);
  if (!loginCheck.allowed) {
    const minutesRemaining = loginCheck.lockedUntil
      ? Math.ceil((loginCheck.lockedUntil - Date.now()) / 60000)
      : 15;
    return {
      success: false,
      error: `Too many failed attempts. Please try again in ${minutesRemaining} minutes.`,
      lockedUntil: loginCheck.lockedUntil,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Record the failed attempt
    await recordFailedLogin(identifier);

    // Don't reveal whether email exists or not
    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Check if user has 2FA enabled - parallelize with clearing login attempts
  if (data.user) {
    // Use admin client (not anon) to avoid RLS recursion on users table (1-2s latency bug)
    // Also pre-warms the Redis profile cache so middleware doesn't hit DB on first dashboard load
    const admin = createAdminClient();
    const [, profileResult] = await Promise.all([
      // Clear failed login attempts
      clearLoginAttempts(identifier),
      // Check 2FA status via admin client — bypasses the RLS recursion that caused 1-2s delay
      admin
        .from("users")
        .select("totp_enabled")
        .eq("id", data.user.id)
        .single(),
    ]);

    const profile = profileResult.data;

    // Pre-warm the cached profile so the middleware Redis lookup is instant
    getCachedUserProfile(data.user.id).catch(() => {});

    if (profile?.totp_enabled) {
      return {
        success: true,
        requires2FA: true,
        userId: data.user.id,
        email: data.user.email,
      };
    }
    
    // Record session and check for new device (non-blocking, completely isolated)
    // This MUST NOT break login under any circumstances
    if (data.session?.access_token) {
      // Fire and forget - don't await these
      recordSession(data.user.id, data.session.access_token, clientHeaders).catch(() => {});
      checkNewDeviceLogin(data.user.id, data.user.email || '', clientHeaders).catch(() => {});
    }
  } else {
    // Still need to clear attempts even if no user data (edge case)
    await clearLoginAttempts(identifier);
  }

  return {
    success: true,
  };
  } catch (error) {
    console.error("[loginAction] Unexpected error:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again later.",
    };
  }
}
