/**
 * Session Monitor - Handles session expiry gracefully
 * 
 * Protects against:
 * 1. Session expiry during checkout
 * 2. Token refresh failures
 * 3. Stale sessions causing data loss
 */

"use client";

import { createClient } from "./supabase/client";

// Session state
let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;
let lastActivityTime = Date.now();
let sessionListeners: Set<(isValid: boolean) => void> = new Set();

// Warning thresholds
const SESSION_CHECK_INTERVAL = 60000; // 1 minute
const INACTIVITY_WARNING_MS = 25 * 60 * 1000; // 25 minutes
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Initialize session monitoring.
 * Call this once in your root layout or app component.
 */
export function initSessionMonitor(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  // Track user activity
  const updateActivity = () => {
    lastActivityTime = Date.now();
  };
  
  window.addEventListener('click', updateActivity);
  window.addEventListener('keydown', updateActivity);
  window.addEventListener('scroll', updateActivity);
  window.addEventListener('touchstart', updateActivity);
  
  // Periodic session check
  sessionCheckInterval = setInterval(checkSession, SESSION_CHECK_INTERVAL);
  
  // Check on visibility change (user returns to tab)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkSession();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Cleanup function
  return () => {
    window.removeEventListener('click', updateActivity);
    window.removeEventListener('keydown', updateActivity);
    window.removeEventListener('scroll', updateActivity);
    window.removeEventListener('touchstart', updateActivity);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
    }
  };
}

/**
 * Check if the current session is still valid.
 */
async function checkSession(): Promise<void> {
  const supabase = createClient();
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      // Session invalid - notify listeners
      notifyListeners(false);
      return;
    }
    
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt && expiresAt - Date.now() < fiveMinutes) {
      // Try to refresh
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        notifyListeners(false);
        return;
      }
    }
    
    // Check inactivity
    const inactiveTime = Date.now() - lastActivityTime;
    if (inactiveTime > SESSION_EXPIRY_MS) {
      // User has been inactive too long - session may have expired server-side
      notifyListeners(false);
      return;
    }
    
    // Session is valid
    notifyListeners(true);
    
    // Show warning if approaching inactivity limit
    if (inactiveTime > INACTIVITY_WARNING_MS) {
      showInactivityWarning();
    }
  } catch {
    // Network error - don't invalidate session, just skip this check
  }
}

/**
 * Subscribe to session validity changes.
 */
export function onSessionChange(callback: (isValid: boolean) => void): () => void {
  sessionListeners.add(callback);
  return () => {
    sessionListeners.delete(callback);
  };
}

function notifyListeners(isValid: boolean): void {
  sessionListeners.forEach(listener => {
    try {
      listener(isValid);
    } catch {
      // Ignore listener errors
    }
  });
}

function showInactivityWarning(): void {
  // Dispatch custom event that components can listen to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('session-inactivity-warning'));
  }
}

/**
 * Hook for checking session before critical operations.
 * Returns true if session is valid, false if expired.
 */
export async function ensureValidSession(): Promise<boolean> {
  const supabase = createClient();
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return false;
    }
    
    // Check if token needs refresh
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt && expiresAt - Date.now() < 60000) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Wrap a critical operation with session validation.
 * Shows login modal if session expired instead of silently failing.
 */
export async function withSessionCheck<T>(
  fn: () => Promise<T>,
  onSessionExpired?: () => void
): Promise<T | null> {
  const isValid = await ensureValidSession();
  
  if (!isValid) {
    if (onSessionExpired) {
      onSessionExpired();
    } else {
      // Default: redirect to login
      if (typeof window !== 'undefined') {
        // Save current URL for redirect back
        sessionStorage.setItem('nexpura_redirect_after_login', window.location.pathname);
        window.location.href = '/login?expired=true';
      }
    }
    return null;
  }
  
  return fn();
}
