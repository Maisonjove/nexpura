/**
 * GET /api/auth/sessions - List active sessions for current user
 * DELETE /api/auth/sessions - Revoke a specific session or all others
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSessions, revokeSession, revokeAllOtherSessions } from '@/lib/session-manager';
import { checkRateLimit } from '@/lib/rate-limit';
import logger from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    // Rate limit
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await checkRateLimit(`sessions-list:${ip}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get session token from cookie for "current session" marking
    const sessionToken = req.cookies.get('sb-access-token')?.value || 
                         req.cookies.get('sb-auth-token')?.value ||
                         undefined;

    const sessions = await getUserSessions(user.id, sessionToken);

    return NextResponse.json({ 
      sessions: sessions.map(s => ({
        id: s.id,
        device: s.device_info,
        ip: s.ip_address,
        location: s.location,
        lastActive: s.last_active_at,
        createdAt: s.created_at,
        isCurrent: s.is_current,
      }))
    });
  } catch (error) {
    logger.error('[sessions] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Rate limit
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await checkRateLimit(`sessions-revoke:${ip}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, revokeAll } = body as { sessionId?: string; revokeAll?: boolean };

    if (revokeAll) {
      // Revoke all sessions except current
      const sessionToken = req.cookies.get('sb-access-token')?.value || 
                           req.cookies.get('sb-auth-token')?.value;
      
      if (!sessionToken) {
        return NextResponse.json({ error: 'Cannot identify current session' }, { status: 400 });
      }

      const revoked = await revokeAllOtherSessions(user.id, sessionToken);
      return NextResponse.json({ revoked, message: `Revoked ${revoked} session(s)` });
    }

    if (sessionId) {
      const success = await revokeSession(user.id, sessionId);
      if (!success) {
        return NextResponse.json({ error: 'Failed to revoke session' }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'sessionId or revokeAll required' }, { status: 400 });
  } catch (error) {
    logger.error('[sessions] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
