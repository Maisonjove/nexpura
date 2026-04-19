/**
 * Local Supabase access-token verification for middleware.
 *
 * Supabase signs access tokens with ES256 using an asymmetric key; the
 * matching public JWK is served at {SUPABASE_URL}/auth/v1/.well-known/jwks.json.
 * We verify the JWT locally with that JWK instead of calling
 * `supabase.auth.getUser()` on every protected request — that call round-trips
 * to Supabase's auth server (~150-300ms over the internet from Vercel's Sydney
 * region). Local verification is ~1-3ms and cryptographically equivalent.
 *
 * Trade-off: token revocation lag equals the remaining access-token TTL
 * (default 1h) because we're not polling the auth server. For forced logout
 * or admin revocation, the window closes at the next token refresh. Acceptable
 * for pilot; not acceptable for high-value admin actions — those should still
 * hit `auth.getUser()` explicitly.
 *
 * Refresh handling is preserved: when the access token is expired or close
 * to expiring (< 5 min), we fall back to the slow path, which triggers
 * Supabase's normal cookie-refresh flow.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const JWKS_URL = new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`);

// JWKS is cached for 1h; jose handles fetch-once-and-reuse across requests.
// The actual network fetch happens at most once per cold lambda invocation.
const JWKS = createRemoteJWKSet(JWKS_URL, {
  cacheMaxAge: 60 * 60 * 1000, // 1 hour
  cooldownDuration: 30_000,
});

// Expire-early threshold: fall back to the slow path this many ms before the
// token actually expires so Supabase's middleware client can rotate the
// session cookie. Set conservatively so we never serve requests with a token
// that will expire mid-request.
const REFRESH_SOON_MS = 5 * 60 * 1000;

export interface LocalAuthUser {
  /** auth.users.id — the `sub` claim. */
  id: string;
  /** User email from the `email` claim. */
  email: string | null;
  /** True iff user_metadata.email_verified is truthy. Matches the shape the
   *  middleware needs to decide whether to redirect to /verify-email. */
  emailVerified: boolean;
  /** Seconds-since-epoch expiration from the `exp` claim. */
  exp: number;
}

/**
 * Verify a Supabase access token locally. Returns null on any verification
 * failure (invalid signature, wrong issuer/audience, expired, malformed).
 */
export async function verifyAccessTokenLocal(
  accessToken: string
): Promise<LocalAuthUser | null> {
  try {
    const { payload } = await jwtVerify(accessToken, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) return null;
    const userMeta = (payload as { user_metadata?: { email_verified?: boolean } })
      .user_metadata;
    return {
      id: sub,
      email: (payload as { email?: string }).email ?? null,
      emailVerified: userMeta?.email_verified === true,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Returns true iff the token is valid AND has more than `REFRESH_SOON_MS`
 * left before expiry. Used by middleware to decide whether to skip the slow
 * auth round-trip for this request.
 */
export function isTokenFresh(user: LocalAuthUser | null): boolean {
  if (!user) return false;
  return user.exp * 1000 - Date.now() > REFRESH_SOON_MS;
}

/**
 * Reassemble the Supabase session cookie from one or more chunks
 * (sb-{ref}-auth-token, sb-{ref}-auth-token.0, sb-{ref}-auth-token.1, ...)
 * and extract the access_token field.
 *
 * Returns null if cookies are absent, malformed, or don't contain an
 * access_token — all of which trigger the slow path.
 */
export function extractAccessToken(
  cookies: Pick<RequestCookie, "name" | "value">[]
): string | null {
  const relevant = cookies.filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
  if (relevant.length === 0) return null;

  // Sort by chunk index (no suffix = -1 so it sorts first; otherwise numeric)
  const sorted = relevant.slice().sort((a, b) => {
    const ai = chunkIndex(a.name);
    const bi = chunkIndex(b.name);
    return ai - bi;
  });

  // Concatenate chunk values in order
  let combined = "";
  for (const c of sorted) combined += c.value;

  if (combined.startsWith("base64-")) combined = combined.slice(7);

  try {
    // Edge runtime: atob is available; Node runtime: Buffer
    const decoded =
      typeof atob === "function"
        ? atob(combined)
        : Buffer.from(combined, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as { access_token?: string };
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

function chunkIndex(name: string): number {
  const m = name.match(/\.(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
}
