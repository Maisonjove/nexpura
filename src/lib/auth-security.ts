import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

// Postgres-backed 5-strike → 15-min login lockout.
//
// Replaces the prior Upstash/Redis implementation. Behavior preserved
// exactly: after 5 failed attempts for an identifier, further attempts
// are rejected for 15 minutes. Backing store is the `login_attempts`
// table; logic lives in check_login_allowed / record_failed_login /
// clear_login_attempts RPCs.
//
// This layer sits on top of rate-limit.ts's "auth" bucket (10 req/min)
// and deliberately stricter — the rate limiter protects against
// high-volume guessing, this protects against patient guessing.
//
// The identifier is typically `email|ip` or similar. We hash it client-
// side here so the table never stores raw PII even if the row leaks.

import { createHash } from "node:crypto";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

function hashIdentifier(identifier: string): string {
  // SHA-256 is fine here — this isn't password hashing, just a one-way
  // key for the rate-limit row. No need for bcrypt/argon.
  return createHash("sha256").update(identifier).digest("hex");
}

export async function checkLoginAttempts(identifier: string): Promise<{
  allowed: boolean;
  attemptsRemaining?: number;
  lockedUntil?: number;
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_login_allowed", {
      p_identifier_hash: hashIdentifier(identifier),
      p_max_attempts: MAX_ATTEMPTS,
    });
    if (error || !data) {
      // Fail-closed would block legitimate users if Postgres hiccups.
      // The rate-limit.ts "auth" bucket already fails closed under the
      // same failure, so here we allow — the stricter layer is optional
      // defense-in-depth. Log loudly so the DB issue gets triaged.
      logger.error("[auth-security] check_login_allowed RPC error", {
        error: error?.message,
      });
      return { allowed: true };
    }
    const result = data as {
      allowed: boolean;
      attempts_remaining: number;
      locked_until: string | null;
    };
    return {
      allowed: result.allowed,
      attemptsRemaining: result.attempts_remaining,
      lockedUntil: result.locked_until ? new Date(result.locked_until).getTime() : undefined,
    };
  } catch (err) {
    logger.error("[auth-security] checkLoginAttempts threw", { error: err });
    return { allowed: true };
  }
}

export async function recordFailedLogin(identifier: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("record_failed_login", {
      p_identifier_hash: hashIdentifier(identifier),
      p_max_attempts: MAX_ATTEMPTS,
      p_lockout_seconds: LOCKOUT_SECONDS,
    });
    if (error) {
      logger.error("[auth-security] record_failed_login RPC error", {
        error: error.message,
      });
    }
  } catch (err) {
    logger.error("[auth-security] recordFailedLogin threw", { error: err });
  }
}

export async function clearLoginAttempts(identifier: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("clear_login_lockouts", {
      p_identifier_hash: hashIdentifier(identifier),
    });
    if (error) {
      logger.error("[auth-security] clear_login_lockouts RPC error", {
        error: error.message,
      });
    }
  } catch (err) {
    logger.error("[auth-security] clearLoginAttempts threw", { error: err });
  }
}
