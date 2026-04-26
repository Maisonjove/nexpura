/**
 * Reserved first-segment names that should never resolve to a tenant slug
 * or any real route. Audit finding QA-002 (Low): the catch-all
 * `(shop)/[subdomain]/page.tsx` matched arbitrary first-segment paths on
 * the apex domain, so probes like `/.env`, `/.git/config`, `/swagger`,
 * `/openapi.json`, `/.DS_Store`, `/package.json` rendered the marketing
 * not-found UI but with HTTP 200. That's a soft-404 — bad for SEO and
 * noisy in scanner-triage logs. The middleware uses
 * {@link isReservedScannerBaitPath} to short-circuit these with a real
 * 404 status before the dynamic shop route ever sees them.
 *
 * Two classes:
 *   1. Anything starting with `.` — dotfiles (.env, .git/*, .DS_Store, .htaccess).
 *   2. Literal scanner-bait filenames / well-known probe paths.
 *
 * Tenant slugs are validated to `[a-z0-9-]+` upstream so no legitimate
 * tenant could ever collide with these.
 *
 * Lives in `lib/` rather than inline in middleware.ts so the predicate
 * can be unit-tested without dragging in the supabase-middleware
 * import chain.
 */
const RESERVED_SCANNER_BAIT_NAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vercel.json",
  "swagger",
  "openapi.json",
  "openapi.yaml",
  "swagger.json",
  "server-status",
  "backup.zip",
  "backup.tar.gz",
  "config.json",
  "composer.json",
  "Gemfile",
  "requirements.txt",
  "web.config",
  "wp-admin",
  "wp-login.php",
  "phpmyadmin",
  ".htaccess",
]);

export function isReservedScannerBaitPath(pathname: string): boolean {
  // Strip leading slashes, take first segment only.
  const trimmed = pathname.replace(/^\/+/, "");
  if (!trimmed) return false;
  const first = trimmed.split("/")[0];
  if (!first) return false;
  // RFC 8615 reserves /.well-known/ for legitimate URIs (security.txt,
  // openid-configuration, etc.). Don't deny those even though they
  // start with a dot.
  if (first === ".well-known") return false;
  // Dotfiles: .env, .env.local, .git, .DS_Store, .htaccess, ...
  if (first.startsWith(".")) return true;
  return RESERVED_SCANNER_BAIT_NAMES.has(first);
}
