import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { migrationUpdateSessionSchema } from '@/lib/schemas';
import { checkRateLimit } from "@/lib/rate-limit";
import { reportServerError } from "@/lib/logger";

/**
 * Launch-QA W5-CRIT-002: this route previously matched the session solely
 * by the body-supplied `sessionId` and had no check that the caller's tenant
 * owned that session. Combined with update-session being the migration
 * runner's control surface, a cross-tenant import was achievable by anyone
 * with a valid login who could guess/intercept a session UUID. The fix:
 * resolve the caller's tenant from the session, load the migration_session
 * row, and reject if its tenant_id does not match. The body is no longer
 * trusted for tenant attribution.
 */

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await checkRateLimit(ip, 'heavy');
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve the caller's tenant from the session. Never trust the body.
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    const callerTenantId = profile?.tenant_id;
    if (!callerTenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = migrationUpdateSessionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { sessionId, status, dataScope, ...rest } = parseResult.data;
    const admin = createAdminClient();

    // Verify the session belongs to the caller's tenant before mutating.
    const { data: existing } = await admin
      .from('migration_sessions')
      .select('tenant_id')
      .eq('id', sessionId)
      .single();
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (existing.tenant_id !== callerTenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (dataScope) updateData.data_scope = dataScope;
    Object.assign(updateData, rest);

    const { data, error } = await admin
      .from('migration_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('tenant_id', callerTenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ session: data });
  } catch (err) {
    // P2-A Item 9: log full err, return generic message — internal
    // PostgREST/RLS error strings aren't useful or safe to leak.
    reportServerError("migration/update-session:POST", err);
    return NextResponse.json({ error: "Migration session update failed" }, { status: 500 });
  }
}
