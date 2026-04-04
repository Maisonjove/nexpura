/**
 * High-Scale Optimizations
 * Handles 1000+ concurrent users without crashes
 */

import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// ============================================
// 1. Request Coalescing
// Multiple identical requests get the same response
// ============================================

const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Coalesce identical requests - if 100 users request the same data
 * at the same time, only 1 database query is made.
 */
export async function coalesceRequest<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

// ============================================
// 2. Stale-While-Revalidate Cache
// Return cached data immediately, refresh in background
// ============================================

interface SWRCacheEntry<T> {
  data: T;
  fetchedAt: number;
}

/**
 * Get data with stale-while-revalidate strategy.
 * Returns stale data immediately while refreshing in background.
 */
export async function getSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    staleMs?: number;    // How long data is considered fresh (default 30s)
    maxAgeMs?: number;   // Maximum age before data is too stale (default 5min)
  } = {}
): Promise<T> {
  const { staleMs = 30000, maxAgeMs = 300000 } = options;

  if (!redis) return fetcher();

  try {
    const cached = await redis.get<SWRCacheEntry<T>>(key);
    const now = Date.now();

    if (cached) {
      const age = now - cached.fetchedAt;

      // Data is fresh - return immediately
      if (age < staleMs) {
        return cached.data;
      }

      // Data is stale but usable - return it and refresh in background
      if (age < maxAgeMs) {
        // Fire off background refresh (don't await)
        refreshInBackground(key, fetcher);
        return cached.data;
      }
    }

    // No cache or too old - fetch fresh
    const fresh = await fetcher();
    await redis.set(key, { data: fresh, fetchedAt: now }, { ex: Math.ceil(maxAgeMs / 1000) });
    return fresh;
  } catch (error) {
    console.error("[swr] Cache error:", error);
    return fetcher();
  }
}

async function refreshInBackground<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  try {
    const fresh = await fetcher();
    await redis?.set(key, { data: fresh, fetchedAt: Date.now() }, { ex: 300 });
  } catch {
    // Ignore background refresh errors
  }
}

// ============================================
// 3. Circuit Breaker
// Prevents cascade failures under heavy load
// ============================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuits = new Map<string, CircuitState>();

const FAILURE_THRESHOLD = 5;
const RECOVERY_TIME_MS = 30000; // 30 seconds

/**
 * Execute a function with circuit breaker protection.
 * If failures exceed threshold, circuit opens and fast-fails requests.
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  fallback?: () => T
): Promise<T> {
  let circuit = circuits.get(name);
  
  if (!circuit) {
    circuit = { failures: 0, lastFailure: 0, state: 'closed' };
    circuits.set(name, circuit);
  }

  const now = Date.now();

  // Check if circuit should recover
  if (circuit.state === 'open' && now - circuit.lastFailure > RECOVERY_TIME_MS) {
    circuit.state = 'half-open';
  }

  // If circuit is open, fail fast
  if (circuit.state === 'open') {
    if (fallback) return fallback();
    throw new Error(`Circuit ${name} is open - service unavailable`);
  }

  try {
    const result = await fn();
    
    // Success - reset circuit
    circuit.failures = 0;
    circuit.state = 'closed';
    
    return result;
  } catch (error) {
    circuit.failures++;
    circuit.lastFailure = now;

    if (circuit.failures >= FAILURE_THRESHOLD) {
      circuit.state = 'open';
    }

    if (fallback) return fallback();
    throw error;
  }
}

// ============================================
// 4. Graceful Degradation Flags
// Disable non-essential features under load
// ============================================

interface LoadState {
  level: 'normal' | 'high' | 'critical';
  updatedAt: number;
}

const LOAD_KEY = 'nexpura:load_state';

/**
 * Set system load level (call from monitoring/alerts).
 */
export async function setLoadLevel(level: LoadState['level']): Promise<void> {
  if (!redis) return;
  await redis.set(LOAD_KEY, { level, updatedAt: Date.now() }, { ex: 300 });
}

/**
 * Get current load level.
 */
export async function getLoadLevel(): Promise<LoadState['level']> {
  if (!redis) return 'normal';
  
  try {
    const state = await redis.get<LoadState>(LOAD_KEY);
    return state?.level ?? 'normal';
  } catch {
    return 'normal';
  }
}

/**
 * Check if a feature should be enabled based on load.
 */
export async function shouldEnableFeature(
  feature: 'ai' | 'reports' | 'exports' | 'bulk_operations'
): Promise<boolean> {
  const loadLevel = await getLoadLevel();

  // Features to disable under high load
  const heavyFeatures = ['ai', 'reports', 'exports', 'bulk_operations'];
  
  if (loadLevel === 'critical') {
    // Only essential operations
    return false;
  }
  
  if (loadLevel === 'high' && heavyFeatures.includes(feature)) {
    return false;
  }

  return true;
}

// ============================================
// 5. Connection Pool Status
// Monitor database connection health
// ============================================

/**
 * Simple health check for database connectivity.
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
}> {
  const start = Date.now();
  
  try {
    // Quick query to test connection
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
      {
        method: 'HEAD',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      }
    );
    
    return {
      healthy: response.ok,
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
    };
  }
}
