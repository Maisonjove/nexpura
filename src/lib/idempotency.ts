/**
 * Server-side idempotency protection for critical financial actions.
 * 
 * Uses Redis (Upstash) for distributed locking with automatic expiry.
 * Falls back to in-memory if Redis unavailable (single-server safety only).
 */

import { Redis } from "@upstash/redis";

// Initialize Redis client if configured
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// In-memory fallback for development/single-server
const memoryLocks = new Map<string, number>();
const LOCK_TTL_MS = 30000; // 30 seconds

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
  return `idem:${action}:${tenantId}:${entityId}:${fingerprint}`;
}

/**
 * Attempt to acquire an idempotency lock.
 * Returns true if lock acquired (proceed with action).
 * Returns false if lock already exists (duplicate request).
 */
export async function acquireIdempotencyLock(key: string, ttlSeconds = 30): Promise<boolean> {
  if (redis) {
    // Redis: Use SET NX (set if not exists) with TTL
    const result = await redis.set(key, Date.now(), { nx: true, ex: ttlSeconds });
    return result === "OK";
  }

  // Memory fallback
  const now = Date.now();
  const existing = memoryLocks.get(key);
  
  if (existing && now - existing < LOCK_TTL_MS) {
    return false; // Lock still valid
  }
  
  memoryLocks.set(key, now);
  
  // Cleanup old locks periodically
  if (memoryLocks.size > 1000) {
    for (const [k, v] of memoryLocks.entries()) {
      if (now - v > LOCK_TTL_MS) {
        memoryLocks.delete(k);
      }
    }
  }
  
  return true;
}

/**
 * Release an idempotency lock early (optional, locks auto-expire).
 */
export async function releaseIdempotencyLock(key: string): Promise<void> {
  if (redis) {
    await redis.del(key);
  } else {
    memoryLocks.delete(key);
  }
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
