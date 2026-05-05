/**
 * GET /api/auth/sessions - List user's active sessions
 * DELETE /api/auth/sessions - Revoke all other sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSessions, revokeAllOtherSessions } from '@/lib/session-manager';
import { checkRateLimit } from '@/lib/rate-limit';
import { reportServerError } from '@/lib/logger';

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate-limit keyed by user.id so a shared-IP neighbour can't DoS
    // the victim's session-listing surface.
    const { success } = await checkRateLimit(user.id, 'api');
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    const sessions = await getUserSessions(user.id, session?.access_token);

    return NextResponse.json({ sessions });
  } catch (error) {
    reportServerError('auth/sessions:GET', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate-limit keyed by user.id so a shared-IP neighbour can't DoS
    // the victim's revoke-all-sessions surface.
    const { success } = await checkRateLimit(user.id, 'api');
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const revoked = await revokeAllOtherSessions(user.id, session.access_token);

    return NextResponse.json({ revoked, message: `Revoked ${revoked} session(s)` });
  } catch (error) {
    reportServerError('auth/sessions:DELETE', error);
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 });
  }
}
