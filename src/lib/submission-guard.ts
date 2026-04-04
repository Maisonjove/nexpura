/**
 * Submission Guard - Prevents duplicate form submissions
 * 
 * Protects against:
 * 1. Users clicking submit 50 times rapidly
 * 2. Slow network causing repeated attempts
 * 3. Browser back button mid-transaction
 */

// Track in-flight requests by key
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicate async operations by key.
 * If the same key is already in flight, returns the existing promise.
 * Prevents duplicate API calls even with rapid button clicks.
 */
export async function withDeduplication<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // If this key is already in flight, return the existing promise
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Create and track the new promise
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Generate a unique submission key for forms.
 * Uses combination of form ID and timestamp window to allow resubmission
 * after a reasonable delay.
 */
export function getSubmissionKey(
  formId: string,
  userId: string,
  windowMs: number = 5000
): string {
  const timeWindow = Math.floor(Date.now() / windowMs);
  return `${formId}:${userId}:${timeWindow}`;
}

/**
 * Idempotency key generator for critical operations.
 * Server can use this to reject duplicate requests.
 */
export function generateIdempotencyKey(
  operation: string,
  entityId: string
): string {
  const timestamp = Math.floor(Date.now() / 10000); // 10-second window
  return `${operation}:${entityId}:${timestamp}`;
}

// Browser storage for cross-page deduplication
const RECENT_SUBMISSIONS_KEY = 'nexpura_recent_submissions';

/**
 * Check if a submission was recently made (survives page refresh).
 * Useful for catching browser back button + resubmit.
 */
export function wasRecentlySubmitted(key: string, windowMs: number = 30000): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const stored = sessionStorage.getItem(RECENT_SUBMISSIONS_KEY);
    if (!stored) return false;
    
    const submissions: Record<string, number> = JSON.parse(stored);
    const lastSubmit = submissions[key];
    
    if (!lastSubmit) return false;
    
    return Date.now() - lastSubmit < windowMs;
  } catch {
    return false;
  }
}

/**
 * Mark a submission as completed.
 */
export function markSubmitted(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = sessionStorage.getItem(RECENT_SUBMISSIONS_KEY);
    const submissions: Record<string, number> = stored ? JSON.parse(stored) : {};
    
    // Clean old entries (older than 5 minutes)
    const now = Date.now();
    Object.keys(submissions).forEach(k => {
      if (now - submissions[k] > 300000) {
        delete submissions[k];
      }
    });
    
    submissions[key] = now;
    sessionStorage.setItem(RECENT_SUBMISSIONS_KEY, JSON.stringify(submissions));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear submission mark (for forms that can be resubmitted).
 */
export function clearSubmissionMark(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = sessionStorage.getItem(RECENT_SUBMISSIONS_KEY);
    if (!stored) return;
    
    const submissions: Record<string, number> = JSON.parse(stored);
    delete submissions[key];
    sessionStorage.setItem(RECENT_SUBMISSIONS_KEY, JSON.stringify(submissions));
  } catch {
    // Ignore
  }
}
