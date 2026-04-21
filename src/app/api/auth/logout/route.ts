import { NextRequest, NextResponse } from 'next/server';
import { clearTwoFactorCookie } from '@/lib/auth/two-factor-cookie';

/**
 * PR-05: clear the HMAC-signed 2FA proof cookie on logout.
 *
 * The cookie is user-ID-bound so an orphaned cookie from user A on a
 * shared browser cannot be used to satisfy middleware for user B (the
 * `uid` binding fails verification). This route is defence-in-depth
 * hygiene — called from the client-side /logout page — to actively
 * delete the cookie instead of relying on the uid mismatch to reject it.
 *
 * Idempotent: safe to call whether or not the cookie is present.
 */
export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || undefined;
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProto ? `${forwardedProto}:` : undefined;

  const res = NextResponse.json({ ok: true });
  clearTwoFactorCookie(res, host, protocol);
  return res;
}
