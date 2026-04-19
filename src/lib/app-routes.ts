/**
 * The set of first-path-segments that identify a top-level app route
 * (not a tenant slug). Shared between middleware (which rewrites
 * `/{slug}/{route}` → `/{route}` internally) and client components
 * that need to detect a tenant slug from `location.pathname`.
 *
 * Keep this in sync with middleware's tenant-slug parser. The mental
 * model is: if `pathname.split('/')[1]` is in APP_ROUTES, the URL is
 * a flat app route; otherwise it's a tenant-prefixed URL and the
 * first segment is the slug.
 *
 * This replaces the earlier "first segment contains a hyphen" heuristic,
 * which incorrectly classified hyphen-less tenant slugs (`test`,
 * `maisonjove`, `nexpura`, etc.) as app routes and broke TopNav +
 * prefetch link generation for every such tenant.
 */
export const APP_ROUTES: ReadonlySet<string> = new Set([
  "dashboard",
  "intake",
  "pos",
  "sales",
  "invoices",
  "quotes",
  "laybys",
  "inventory",
  "customers",
  "suppliers",
  "memo",
  "stocktakes",
  "repairs",
  "bespoke",
  "workshop",
  "appraisals",
  "passports",
  "expenses",
  "financials",
  "reports",
  "refunds",
  "vouchers",
  "eod",
  "marketing",
  "tasks",
  "copilot",
  "website",
  "documents",
  "integrations",
  "reminders",
  "support",
  "settings",
  "billing",
  "suspended",
  "communications",
  "notifications",
  "migration",
  "ai",
  "enquiries",
  "print-queue",
  "actions",
  // non-app but definitely-not-a-slug segments
  "login",
  "signup",
  "onboarding",
  "verify",
  "verify-email",
  "forgot-password",
  "reset-password",
  "track",
  "admin",
  "api",
  "_next",
  "offline",
  "pricing",
  "features",
  "about",
  "contact",
  "blog",
  "terms",
  "privacy",
  "switching",
  "support-access",
]);

/**
 * Derive the tenant slug from a client-side pathname, or null if the
 * pathname is a flat app route / public page.
 */
export function tenantSlugFromPathname(
  pathname: string | null | undefined,
): string | null {
  if (!pathname) return null;
  const seg = pathname.split("/")[1];
  if (!seg) return null;
  if (APP_ROUTES.has(seg)) return null;
  return seg;
}
