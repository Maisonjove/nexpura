"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { resolveReadLocationScope } from "@/lib/location-read-scope";
import logger from "@/lib/logger";
import { flushSentry } from "@/lib/sentry-flush";

/**
 * Fast tenant ID resolution from middleware-set headers.
 * Eliminates supabase.auth.getUser() + DB query (~70-150ms savings per call).
 */
async function getTenantId(): Promise<{ tenantId: string; userId: string | null }> {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  const userId = headersList.get(AUTH_HEADERS.USER_ID);
  if (!tenantId) throw new Error("Not authenticated");
  return { tenantId, userId };
}

export interface SaleWithLocation {
  id: string;
  sale_number: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  payment_method: string | null;
  total: number;
  amount_paid: number | null;
  sale_date: string;
  created_at: string;
  location_id: string | null;
  locationName?: string;
}

/**
 * Cursor-paginated sales response. The hub uses the first page (50 rows);
 * "View all" / future filter UI loads further pages by calling getSales
 * with the returned `nextCursor`.
 *
 * C-02 (post-audit-batch QA): the previous shape returned `SaleWithLocation[]`
 * with no cursor and no error channel. Audit said:
 *
 *   "Likely a query/permission bug on the list endpoint — check tenant
 *    scoping and pagination cursor."
 *
 * Root cause: every list-query failure (legacy service-role key revocation
 * 2026-04-21, RLS rejection, schema drift, transient PostgREST error) was
 * silently swallowed by `const { data: sales } = await query;` — `data` is
 * `null` on error and the caller saw an empty list, indistinguishable from
 * "no sales yet". Page rendered the empty-state CTA. Users perceived this
 * as "broken sales page". Same shape for KPIs in `page.tsx`.
 *
 * Fix at the right layer (Joey's directive): error-check at the query
 * site, log via `logger.error` so Sentry captures with tenant_id, user_id,
 * route, payload_hash, and surface a typed error so the page's Suspense
 * boundary renders the ErrorBoundary fallback instead of fake-empty UI.
 */
export interface SalesListPage {
  sales: SaleWithLocation[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface GetSalesOptions {
  /** Cursor: ISO timestamp of the last seen `created_at`. Pass null/undefined for first page. */
  cursor?: string | null;
  /** Page size. Defaults to 50. Capped at 200 to bound payload. */
  limit?: number;
}

export const SALES_LIST_PAGE_SIZE = 50;
const SALES_LIST_MAX_PAGE_SIZE = 200;

function payloadHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value ?? {}))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Legacy entrypoint kept for backwards compatibility with the in-page
 * client refetcher (`SalesListClient` re-runs this on location change).
 * New callers should prefer `getSalesPage` for the cursor + hasMore data.
 */
export async function getSales(locationIds: string[] | null): Promise<SaleWithLocation[]> {
  const page = await getSalesPage(locationIds);
  return page.sales;
}

export async function getSalesPage(
  locationIds: string[] | null,
  options: GetSalesOptions = {},
): Promise<SalesListPage> {
  const { tenantId, userId } = await getTenantId();
  const admin = createAdminClient();
  const limit = Math.min(
    Math.max(options.limit ?? SALES_LIST_PAGE_SIZE, 1),
    SALES_LIST_MAX_PAGE_SIZE,
  );
  const cursor = options.cursor ?? null;

  // Hard-scope to the user's allowed locations BEFORE respecting the
  // client-supplied filter. A location-restricted user cannot see any
  // location outside their allow-list even if the client passes
  // locationIds=null (all-locations). Intersects the client filter with
  // the allow-list when both are present. See src/lib/location-read-scope.ts.
  if (userId) {
    const scope = await resolveReadLocationScope(userId, tenantId);
    if (!scope.all) {
      const allowSet = new Set(scope.allowedIds);
      if (locationIds && locationIds.length > 0) {
        locationIds = locationIds.filter((id) => allowSet.has(id));
        if (locationIds.length === 0) {
          // intersection empty — restricted user cannot see any of the
          // requested locations. Empty page (NOT a swallowed error).
          return { sales: [], nextCursor: null, hasMore: false };
        }
      } else {
        locationIds = scope.allowedIds.length > 0 ? scope.allowedIds : ["00000000-0000-0000-0000-000000000000"];
      }
    }
  }

  // Determine if we need location names (when showing multiple locations)
  const showLocationNames = !locationIds || locationIds.length > 1;
  const locationMap: Map<string, string> = new Map();

  if (showLocationNames) {
    const { data: locations, error: locErr } = await admin
      .from("locations")
      .select("id, name")
      .eq("tenant_id", tenantId);
    // C-02: errors here used to be swallowed (location names silently
    // missing in the rendered table). They no longer block the list, but
    // are logged so a recurring location-fetch failure shows up in Sentry.
    if (locErr) {
      logger.error("[sales/list] location-name lookup failed", {
        tenantId,
        userId,
        route: "/sales",
        payload_hash: payloadHash({ tenantId }),
        err: locErr,
      });
      await flushSentry();
    }
    for (const loc of locations ?? []) {
      locationMap.set(loc.id, loc.name);
    }
  }

  // Build query — exclude soft-deleted sales (deleted_at IS NULL) so the
  // hub list, recent-sales panel, and KPI aggregates all stop showing
  // sales that an operator has thrown away.
  //
  // Pagination: keyset on `created_at` desc. The cursor is the smallest
  // (most-recent-but-already-seen) created_at the previous page returned;
  // we ask for rows strictly older than that. We also fetch `limit + 1`
  // rows so we can compute `hasMore` without a separate COUNT query —
  // the (limit+1)-th row is dropped from the response and its created_at
  // becomes the next cursor. Audit ID C-02, Joey's spec: "Paginated list
  // of all sales with filters."
  let query = admin
    .from("sales")
    .select("id, sale_number, customer_name, customer_email, status, payment_method, total, amount_paid, sale_date, created_at, location_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false }) // tiebreaker for created_at collisions
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  // Apply location filter
  if (locationIds && locationIds.length > 0) {
    if (locationIds.length === 1) {
      query = query.eq("location_id", locationIds[0]);
    } else {
      query = query.in("location_id", locationIds);
    }
  }

  const { data: sales, error: salesErr } = await query;

  // C-02: stop swallowing the error. Surface it to telemetry AND to the
  // caller via throw — the page's Suspense boundary catches and renders
  // the ErrorBoundary section="main-content" fallback instead of an
  // empty list that masquerades as "no sales".
  if (salesErr) {
    logger.error("[sales/list] sales query failed", {
      tenantId,
      userId,
      route: "/sales",
      payload_hash: payloadHash({ tenantId, locationIds, cursor, limit }),
      err: salesErr,
    });
    await flushSentry();
    throw new Error(`Failed to load sales: ${salesErr.message}`);
  }

  const rows = sales ?? [];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = visible[visible.length - 1];
  const nextCursor = hasMore && lastRow ? lastRow.created_at : null;

  return {
    sales: visible.map((sale) => ({
      ...sale,
      locationName:
        showLocationNames && sale.location_id
          ? locationMap.get(sale.location_id)
          : undefined,
    })),
    nextCursor,
    hasMore,
  };
}
