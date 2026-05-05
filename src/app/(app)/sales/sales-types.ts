/**
 * Pure type + constant module for the /sales surface.
 *
 * Lives outside `sales-actions.ts` so non-async exports (interfaces,
 * const-numbers) don't trip the Next.js SWC server-action transform's
 * "only async functions are allowed to be exported in a 'use server'
 * file" rule. See CONTRIBUTING.md §14 for the full rationale (the
 * transform produces a module with NO exports at all when violated;
 * tsc + vitest don't catch it, only `pnpm build` does).
 *
 * Caught on the wave-2 prod deploy (2026-05-05). Original PR #161
 * placed `SALES_LIST_PAGE_SIZE` at the top of `sales-actions.ts`; that
 * file carries a `"use server"` directive, so the const export
 * cascaded the entire file's exports to disappear. Moving the
 * non-async surface here is the canonical fix.
 *
 * Server actions stay in `sales-actions.ts`.
 */

/** Per-row shape returned by the sales list query. */
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
 * Cursor-paginated sales response. The hub uses the first page;
 * "View all" / future filter UI loads further pages by calling
 * `getSalesPage` with the returned `nextCursor`.
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

/** Default page size used by both `getSales` (legacy) and `getSalesPage`. */
export const SALES_LIST_PAGE_SIZE = 50;

/** Hard cap on a caller-supplied `limit` to bound payload size. */
export const SALES_LIST_MAX_PAGE_SIZE = 200;
