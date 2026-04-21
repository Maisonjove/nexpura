import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/auth/me
 *
 * Thin session probe used by /verify-2fa to resolve `userId` + `email`
 * when the middleware bounces an already-authenticated but un-promoted
 * user to the 2FA page. The client previously required `userId` in the
 * URL (legacy login-flow contract); with middleware enforcement
 * (PR-05) the user can land on /verify-2fa without those params.
 *
 * Returns only non-sensitive identity (no tokens, no profile data).
 * Callers without a session get 401 so the page redirects to /login.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ userId: user.id, email: user.email ?? null });
}
