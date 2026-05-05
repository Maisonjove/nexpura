'use client';

/**
 * DeployVersionBanner — client-side guardrail against RSC version skew.
 *
 * WHAT THIS FIXES (C-06)
 * ----------------------
 * When a deploy ships while a user has the app open, the still-loaded
 * client bundle (Deploy A) starts requesting RSC payloads from servers
 * already serving Deploy B. The mismatch surfaces to the user as
 * React error #419 ("unexpected response from server") on the next
 * link click — no recovery, blank screen, manual refresh needed.
 *
 * Next.js 16's built-in deploy-ID guard works on Vercel by sending an
 * `x-deployment-id` header on RSC fetches and rejecting at the edge if
 * it doesn't match the current deploy. That guard is bypassed in our
 * stack because the Service Worker (public/sw.js) proxies RSC requests
 * through the Cache API: a cached RSC response from Deploy A can be
 * handed to a Deploy A client by the SW long after Deploy B is live,
 * with neither layer noticing skew.
 *
 * MECHANISM
 * ---------
 * On mount this component installs a global `fetch` interceptor that
 * inspects the `x-deployment-id` response header on every request. If
 * the server's deploy ID differs from the client's compiled-in
 * `NEXT_PUBLIC_BUILD_ID`, we know skew has occurred:
 *   1. Emit a Sentry breadcrumb + capture an `info` event with both
 *      build IDs and the current route (telemetry, not error).
 *   2. Show a small toast banner ("A new version is available.
 *      Reloading…").
 *   3. After 2s, call `window.location.reload()` — full MPA reload
 *      pulls the fresh client bundle that matches the live deploy.
 *
 * Why a fetch interceptor and not error-boundary detection of #419?
 *   - The interceptor catches skew on the FIRST RSC fetch after
 *     deploy, before React tries to render. Error-boundary detection
 *     means the user sees the broken page first, then we react.
 *   - One mechanism that fires on every response is testable +
 *     deterministic; sniffing minified React error codes is fragile
 *     across React major versions.
 *
 * SCOPE
 * -----
 * - DEV mode (NODE_ENV !== 'production'): banner mounts but the
 *   interceptor is dormant — local dev cycles produce constant build
 *   ID changes, so reload-on-mismatch would be hostile.
 * - When `NEXT_PUBLIC_BUILD_ID` is empty (no SHA at build time, e.g.
 *   a preview deploy without git context): dormant — we have no
 *   stable client ID to compare against, so any check is meaningless.
 * - Reload is fired AT MOST ONCE per session via a module-level latch.
 *   Subsequent mismatches in the 2s grace window are no-ops.
 *
 * FOOTER PIN
 * ----------
 * The collapsed badge in the bottom-right shows the SHA-12 short ID
 * on hover/click, matching QA's Section 4 #10 acceptance criterion.
 * Hidden by default to avoid visual noise; appears only on user
 * interaction.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/nextjs';

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? '';
const IS_PROD = process.env.NODE_ENV === 'production';
const RELOAD_DELAY_MS = 2000;

// Module-level latch — once a skew is detected, suppress further
// detections in the same page session so we don't fire telemetry for
// every queued in-flight RSC fetch.
let skewDetected = false;

interface FetchInterceptorOptions {
  clientBuildId: string;
  onMismatch: (serverBuildId: string) => void;
}

/**
 * Install a global fetch interceptor that compares the
 * `x-deployment-id` response header against `clientBuildId`. Returns a
 * teardown function that restores the original fetch.
 *
 * Exported for unit-test reach — the interceptor logic is the entire
 * detection mechanism, and we want tests to assert behaviour directly.
 */
export function installDeployMismatchInterceptor(
  opts: FetchInterceptorOptions,
): () => void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return () => {};
  }
  if (!opts.clientBuildId) {
    // No anchor to compare against; install a no-op teardown.
    return () => {};
  }
  const originalFetch = window.fetch;
  const wrapped: typeof window.fetch = async (input, init) => {
    const response = await originalFetch.call(window, input, init);
    try {
      const serverBuildId = response.headers.get('x-deployment-id');
      if (
        serverBuildId &&
        serverBuildId !== opts.clientBuildId &&
        !skewDetected
      ) {
        skewDetected = true;
        opts.onMismatch(serverBuildId);
      }
    } catch {
      // Header access shouldn't throw, but defensive — never let the
      // interceptor break a real fetch flow.
    }
    return response;
  };
  window.fetch = wrapped;
  return () => {
    if (window.fetch === wrapped) {
      window.fetch = originalFetch;
    }
  };
}

/**
 * Test-only hook: reset the module-level latch so a unit test can
 * assert the same detection logic across multiple cases.
 *
 * Not part of the public API — guarded by a NODE_ENV check at the
 * call site to avoid accidental production reset.
 */
export function __resetSkewLatchForTests(): void {
  skewDetected = false;
}

interface UseDeployMismatchDetectionResult {
  mismatched: boolean;
  serverBuildId: string | null;
  reload: () => void;
}

/**
 * React-side wiring around `installDeployMismatchInterceptor`. Returns
 * the current mismatch state for UI rendering.
 *
 * Active only when:
 *   - `NODE_ENV === 'production'` (dev cycles produce constant ID
 *     churn; banner would never settle)
 *   - `NEXT_PUBLIC_BUILD_ID` is non-empty
 */
export function useDeployMismatchDetection(): UseDeployMismatchDetectionResult {
  const [mismatched, setMismatched] = useState(false);
  const [serverBuildId, setServerBuildId] = useState<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerReload = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (!IS_PROD) return;
    if (!BUILD_ID) return;

    const teardown = installDeployMismatchInterceptor({
      clientBuildId: BUILD_ID,
      onMismatch: (serverId) => {
        // Telemetry — informational, not Error.
        try {
          Sentry.addBreadcrumb({
            category: 'deploy-skew',
            level: 'info',
            message: 'deploy_id_skew_detected',
            data: {
              deployId_client: BUILD_ID,
              deployId_server: serverId,
              route:
                typeof location !== 'undefined' ? location.pathname : null,
            },
          });
          Sentry.captureMessage('deploy_id_skew_detected', {
            level: 'info',
            tags: {
              route:
                typeof location !== 'undefined' ? location.pathname : 'unknown',
            },
            extra: {
              deployId_client: BUILD_ID,
              deployId_server: serverId,
            },
          });
        } catch {
          // Never block recovery on telemetry failure.
        }

        setServerBuildId(serverId);
        setMismatched(true);
        if (reloadTimerRef.current === null) {
          reloadTimerRef.current = setTimeout(triggerReload, RELOAD_DELAY_MS);
        }
      },
    });

    return () => {
      teardown();
      if (reloadTimerRef.current !== null) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [triggerReload]);

  return { mismatched, serverBuildId, reload: triggerReload };
}

/**
 * Visible UI: shows a small banner when skew is detected. Also pins a
 * tiny collapsed SHA badge in the bottom-right (per QA Section 4 #10)
 * so support / QA can read off the live build at a glance.
 */
export function DeployVersionBanner() {
  const { mismatched, reload } = useDeployMismatchDetection();
  const [badgeOpen, setBadgeOpen] = useState(false);

  if (!IS_PROD) return null;
  if (!BUILD_ID) return null;

  return (
    <>
      {mismatched ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="deploy-version-banner"
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            background: '#1A1A1A',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: 8,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>A new version is available. Reloading…</span>
          <button
            type="button"
            onClick={reload}
            style={{
              background: 'transparent',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Reload now
          </button>
        </div>
      ) : null}
      <button
        type="button"
        data-testid="deploy-version-badge"
        onClick={() => setBadgeOpen((v) => !v)}
        title="Build identifier"
        style={{
          position: 'fixed',
          bottom: 8,
          right: 8,
          zIndex: 99998,
          background: 'rgba(0,0,0,0.45)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 4,
          padding: badgeOpen ? '4px 8px' : '4px 6px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 10,
          cursor: 'pointer',
          opacity: badgeOpen ? 1 : 0.45,
        }}
      >
        {badgeOpen ? BUILD_ID : 'v'}
      </button>
    </>
  );
}

export default DeployVersionBanner;
