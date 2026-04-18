// Host-aware cookie options for Supabase session cookies.
//
// Previously we pinned `domain` to `process.env.NEXT_PUBLIC_COOKIE_DOMAIN`
// (= `.nexpura.com` in Vercel). That made the app unreachable from any
// non-nexpura.com host — Vercel preview URLs, branch deploys, localhost —
// because browsers silently drop a Set-Cookie whose Domain doesn't match
// the request host. Login would 200 with a valid JWT but the cookie was
// never stored, producing an infinite redirect to /login.
//
// We now compute the attributes from the current host on every call:
// share cookies across *.nexpura.com only when the current host is itself
// nexpura.com or a subdomain; on any other host, omit Domain so the
// cookie is scoped to that exact host.

export function getCookieDomain(
  host: string | undefined | null
): string | undefined {
  if (!host) return undefined;
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === "nexpura.com" || hostname.endsWith(".nexpura.com")) {
    return ".nexpura.com";
  }
  return undefined;
}

export function getIsSecure(
  protocol: string | undefined | null,
  host: string | undefined | null
): boolean {
  const hostname = host?.split(":")[0].toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (protocol === "http:" || protocol === "http") return false;
  return true;
}
