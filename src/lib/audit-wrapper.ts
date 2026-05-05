/**
 * C-05 — Activity Log auto-emit middleware.
 *
 * The activity log was empty in production because almost no mutating
 * code paths called `logAuditEvent`. The QA audit recommended:
 *   "Add a middleware that auto-logs on every mutation, with allow-list
 *    for noisy ones."
 *
 * Strategy (Option D — combo with DB triggers):
 *
 *   * `withAuditLog(handler, opts)` is the route-level wrapper. It runs
 *     the handler, and on success emits one rich audit row with the
 *     resolved user_id (from session), action, entity info, and any
 *     metadata the route hands us via `extractMetadata`. On failure it
 *     emits nothing — only successful mutations show up in the activity
 *     feed (failed POSTs are noise the user didn't actually do).
 *
 *   * The DB trigger function (see migration
 *     `20260505_activity_log_triggers.sql`) is the safety net: anything
 *     that escapes the wrapper still gets a `<table>.<op>` row.
 *
 *   * The wrapper avoids double-emit by being explicit: when a route
 *     opts in via withAuditLog, it expects to be the source of truth.
 *     If you also need the trigger NOT to fire, set
 *     `audit.skip = 'true'` on the connection inside the same tx
 *     (low-priority; the UI groups by entity_id+created_at so dupes are
 *     visible but not catastrophic).
 *
 *   * Failures of the audit emit go to Sentry via logger.error; they
 *     never bubble up to the user. Audit is observability, not a
 *     business invariant.
 *
 * Allow-list:
 *   The wrapper is opt-in per-route. The current opt-ins are listed in
 *   `AUDIT_OPT_IN_ROUTES` below for documentation; each entry must
 *   actually wire `withAuditLog` at the export site too — the constant
 *   here is the canonical list, not the enforcement.
 *
 *   Routes that are intentionally NOT wrapped are documented in the
 *   migration's deny-list comment.
 *
 * Canary:
 *   `/api/invite/accept` — the very first thing a new manager does
 *   after accepting their invite must show in /settings/activity. See
 *   the integration test at
 *     src/app/api/invite/accept/__tests__/audit-canary.test.ts
 */

import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";
import logger from "./logger";
import { logAuditEvent, type AuditAction, type EntityType } from "./audit";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";

/**
 * Documented allow-list. The HOF doesn't read this constant at runtime —
 * it's here so a future contributor can grep for it and see at a glance
 * which routes are opted into rich audit emit. Update this list when
 * you add `withAuditLog` to a new route.
 */
export const AUDIT_OPT_IN_ROUTES: ReadonlyArray<{
  path: string;
  action: AuditAction;
  notes: string;
}> = [
  {
    path: "/api/invite/accept",
    action: "team_member_invite",
    notes:
      "Canary route — when this stops emitting, the wrapper itself is broken. " +
      "The new manager's first action (claim-invite) is the most-visible signal " +
      "that the activity log is functional.",
  },
];

export interface WithAuditLogOptions<TResult> {
  /**
   * Semantic action name. Becomes `audit_logs.action`. Use the typed
   * AuditAction union — adding a new one means widening the type in
   * src/lib/audit.ts (one place, intentional friction).
   */
  action: AuditAction;
  entityType: EntityType;
  /**
   * Optional resolver to pull tenant_id, entity_id, and metadata from
   * the request + result after the handler runs. Both forms allowed:
   *   - return null to skip emit (e.g. the request was a no-op)
   *   - return a partial — tenantId is required, the rest optional.
   *
   * The wrapper passes the SAME `request` it passed to the handler, plus
   * the parsed handler `response`. Note: the response body has already
   * been consumed by Next so we re-derive what we need from the
   * resolver's own data fetch if it needs the new row's id.
   */
  extract?: (ctx: {
    request: NextRequest;
    response: TResult;
    sessionUserId: string | null;
  }) => Promise<AuditExtractResult | null> | AuditExtractResult | null;
}

export interface AuditExtractResult {
  tenantId: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /**
   * Override the userId emitted to audit_logs.user_id. Falls back to
   * the session user id if omitted. Useful when the route operates on
   * behalf of another user (e.g. admin force-resets a team member).
   */
  userIdOverride?: string;
}

// Route handlers in App Router can be `(req)`, `(req, { params })`, or
// `(req: Request)`. Mirror the shape used by withSentryFlush to keep
// composition predictable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler<TResult = Response> = (...args: any[]) => Promise<TResult>;

/**
 * Internal header the handler can set to pass tenantId/entityId/etc.
 * to the wrapper without leaking them in the public response body. The
 * wrapper deletes this header before returning the response upstream.
 *
 * Format: JSON-encoded `AuditExtractResult`. Use the helper
 * `setAuditContext(response, ctx)` to write it (handles JSON encoding).
 */
export const AUDIT_CONTEXT_HEADER = "x-audit-ctx";

export function setAuditContext<R extends Response>(
  response: R,
  ctx: AuditExtractResult
): R {
  try {
    response.headers.set(AUDIT_CONTEXT_HEADER, JSON.stringify(ctx));
  } catch {
    // Defensive: a malformed ctx (BigInt, circular ref) shouldn't
    // bring the handler down. The DB trigger remains the safety net.
  }
  return response;
}

function readAuditContext(response: Response): AuditExtractResult | null {
  const raw = response.headers.get(AUDIT_CONTEXT_HEADER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuditExtractResult;
  } catch {
    return null;
  } finally {
    response.headers.delete(AUDIT_CONTEXT_HEADER);
  }
}

/**
 * Wrap a Next.js App Router route handler so a successful mutation
 * emits one audit row. The wrapper:
 *
 *   1. Runs the handler. If it throws, re-throws — no emit.
 *   2. On any non-2xx response, no emit (mirrors "user didn't do this").
 *   3. On 2xx, resolves the session user (via the SSR Supabase client)
 *      and runs the optional `extract()` callback to pull tenant_id +
 *      entity info from the request/response. If the handler set the
 *      AUDIT_CONTEXT_HEADER via setAuditContext(), the wrapper reads
 *      that as the source of truth (extract() takes precedence).
 *   4. Calls logAuditEvent with the resolved fields. Failures are
 *      caught and reported via Sentry only; the response is unchanged.
 */
export function withAuditLog<TResult extends Response>(
  handler: RouteHandler<TResult>,
  opts: WithAuditLogOptions<TResult>
): RouteHandler<TResult> {
  return async (...args: Parameters<RouteHandler<TResult>>) => {
    const response = await handler(...args);

    // Only emit on success. Mirrors the "did the user actually do this?"
    // semantics — a failed POST shouldn't pollute the activity feed.
    if (response.status < 200 || response.status >= 300) {
      return response;
    }

    // Best-effort emit. Audit is observability — never break the user
    // request because we couldn't write a row. All errors below funnel
    // to Sentry via logger.error; the response we already produced is
    // returned untouched.
    try {
      const request = args[0] as NextRequest;

      const sessionUserId = await resolveSessionUserId();

      const headerCtx = readAuditContext(response);

      // Resolution order:
      //   1. extract() — most flexible, sees the response object.
      //      Returning null means "skip emit" — wrapper bails.
      //   2. AUDIT_CONTEXT_HEADER — handler-set JSON, simplest.
      //   3. fallback: user.tenant_id only — baseline emit, no entity.
      let baseline: AuditExtractResult | null = null;
      if (opts.extract) {
        const extracted = await opts.extract({
          request,
          response,
          sessionUserId,
        });
        if (extracted === null) {
          // Explicit skip
          return response;
        }
        baseline = extracted;
      } else if (headerCtx) {
        baseline = headerCtx;
      } else if (sessionUserId) {
        baseline = await resolveTenantFromUser(sessionUserId);
      }

      if (!baseline?.tenantId) {
        logger.warn(
          "[audit-wrapper] no tenant resolvable for audit emit; skipping",
          { action: opts.action, sessionUserId }
        );
        return response;
      }

      await logAuditEvent({
        tenantId: baseline.tenantId,
        userId: baseline.userIdOverride ?? sessionUserId ?? undefined,
        action: opts.action,
        entityType: opts.entityType,
        entityId: baseline.entityId,
        oldData: baseline.oldData,
        newData: baseline.newData,
        metadata: {
          ...(baseline.metadata ?? {}),
          source: "route_wrapper",
          route: new URL(request.url).pathname,
        },
      });
    } catch (err) {
      // Surfaces to Sentry but does not affect the response. The DB
      // trigger should have caught the underlying mutation anyway.
      logger.error("[audit-wrapper] emit failed (non-fatal)", {
        action: opts.action,
        entityType: opts.entityType,
        err: err instanceof Error ? err.message : String(err),
      });
      Sentry.captureException(err, {
        tags: { component: "audit-wrapper", action: opts.action },
      });
    }

    return response;
  };
}

/**
 * Resolve the authenticated user id from the SSR cookies. Returns null
 * if there's no session — public routes wrapped by withAuditLog will
 * still emit (with userId omitted), but that's the right behaviour for
 * things like password-reset confirmations done while logged out.
 */
async function resolveSessionUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fallback when no extractor is provided: look up the user's tenant_id
 * from the `users` table. Single round-trip, admin client (the user
 * can read their own row anyway under RLS, but admin avoids a second
 * cookie-bound client).
 */
async function resolveTenantFromUser(
  userId: string
): Promise<AuditExtractResult | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (!data?.tenant_id) return null;
    return { tenantId: data.tenant_id as string };
  } catch {
    return null;
  }
}
