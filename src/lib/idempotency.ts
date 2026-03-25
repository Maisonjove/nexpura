/**
 * Server-side idempotency protection for critical financial actions.
 * 
 * Uses Supabase as the idempotency store (table: idempotency_locks).
 * This is more reliable than external Redis since Supabase is already our DB.
 * 
 * Pattern: INSERT with unique constraint on key, DELETE after TTL
 */

import { createAdminClient } from "./supabase/admin";
import logger from "@/lib/logger";

const LOCK_TTL_SECONDS = 30;

/**
 * Generate idempotency key from action parameters.
 * Key format: action:tenant:entity:fingerprint
 */
export function generateIdempotencyKey(
  action: string,
  tenantId: string,
  entityId: string,
  fingerprint: string
): string {
  return `${action}:${tenantId}:${entityId}:${fingerprint}`;
}

/**
 * Attempt to acquire an idempotency lock.
 * Returns true if lock acquired (proceed with action).
 * Returns false if lock already exists (duplicate request).
 */
export async function acquireIdempotencyLock(key: string, ttlSeconds = LOCK_TTL_SECONDS): Promise<boolean> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  
  // Clean up expired locks first (best effort)
  await supabase
    .from("idempotency_locks")
    .delete()
    .lt("expires_at", new Date().toISOString());
  
  // Try to insert lock - will fail if key exists and not expired
  const { error } = await supabase
    .from("idempotency_locks")
    .insert({
      key,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });
  
  if (error) {
    // Unique constraint violation means lock exists
    if (error.code === "23505") {
      return false;
    }
    // Other errors - log but allow (fail open for availability)
    logger.error("Idempotency lock error:", error);
    return true;
  }
  
  return true;
}

/**
 * Release an idempotency lock early (optional, locks auto-expire).
 */
export async function releaseIdempotencyLock(key: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("idempotency_locks").delete().eq("key", key);
}

/**
 * Create a payment fingerprint from amount and method.
 * Used to detect duplicate payment submissions.
 */
export function createPaymentFingerprint(
  amount: number,
  paymentMethod: string,
  paymentDate: string
): string {
  // Round amount to cents and create hash-like string
  const amountCents = Math.round(amount * 100);
  return `${amountCents}:${paymentMethod}:${paymentDate}`;
}

/**
 * Wrapper for idempotent actions.
 * Automatically generates key and handles lock acquisition.
 */
export async function withIdempotency<T>(
  action: string,
  tenantId: string,
  entityId: string,
  fingerprint: string,
  fn: () => Promise<T>
): Promise<T | { error: string; duplicate: true }> {
  const key = generateIdempotencyKey(action, tenantId, entityId, fingerprint);
  
  const acquired = await acquireIdempotencyLock(key);
  if (!acquired) {
    return { 
      error: "Duplicate request detected. Please wait a moment and refresh.",
      duplicate: true 
    };
  }
  
  try {
    return await fn();
  } finally {
    // Keep lock for TTL to prevent rapid retries
    // Don't release early for financial actions
  }
}

/**
 * Check if idempotency system is working (for health checks)
 */
export async function checkIdempotencyHealth(): Promise<{
  healthy: boolean;
  backend: "supabase";
  error?: string;
}> {
  try {
    const testKey = `health:${Date.now()}`;
    const acquired = await acquireIdempotencyLock(testKey, 1);
    if (acquired) {
      await releaseIdempotencyLock(testKey);
    }
    return { healthy: true, backend: "supabase" };
  } catch (e) {
    return { healthy: false, backend: "supabase", error: String(e) };
  }
}
