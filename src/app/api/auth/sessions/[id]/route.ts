/**
 * DELETE /api/auth/sessions/[id] - Revoke a specific session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revokeSession } from '@/lib/session-manager';
import { checkRateLimit } from '@/lib/rate-limit';
import { reportServerError } from '@/lib/logger';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate-limit keyed by user.id so a shared-IP neighbour can't DoS
    // the victim's session-revoke surface.
    const { success } = await checkRateLimit(user.id, 'api');
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { id: sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const revoked = await revokeSession(user.id, sessionId);
    
    if (!revoked) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    reportServerError('auth/sessions/[id]:DELETE', error);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
