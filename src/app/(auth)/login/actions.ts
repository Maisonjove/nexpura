"use server";
// login actions

import { createClient } from "@/lib/supabase/server";
import {
  checkLoginAttempts,
  recordFailedLogin,
  clearLoginAttempts,
} from "@/lib/auth-security";
import { recordSession, checkNewDeviceLogin } from "@/lib/session-manager";
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
    const clientHeaders = await getClientHeaders();
    // Use a combination of email + IP for rate limiting
    // This prevents account enumeration while still protecting against distributed attacks
    const identifier = `${email.toLowerCase()}:${clientHeaders.ip}`;

  // Check if login attempts are allowed
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

  const supabase = await createClient();

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

  // Clear failed login attempts on successful login
  await clearLoginAttempts(identifier);

  // Check if user has 2FA enabled
  if (data.user) {
    const { data: profile } = await supabase
      .from("users")
      .select("totp_enabled")
      .eq("id", data.user.id)
      .single();

    if (profile?.totp_enabled) {
      return {
        success: true,
        requires2FA: true,
        userId: data.user.id,
        email: data.user.email,
      };
    }
    
    // Record session and check for new device (non-blocking)
    if (data.session?.access_token) {
      recordSession(data.user.id, data.session.access_token, clientHeaders).catch(console.error);
      checkNewDeviceLogin(data.user.id, data.user.email || '', clientHeaders).catch(console.error);
    }
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
