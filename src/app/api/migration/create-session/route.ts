import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { migrationCreateSessionSchema } from '@/lib/schemas';
import { checkRateLimit } from "@/lib/rate-limit";

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

    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const body = await req.json();
    const parseResult = migrationCreateSessionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { sourcePlatform } = parseResult.data;
    const admin = createAdminClient();

    const { data: session, error } = await admin
      .from('migration_sessions')
      .insert({
        tenant_id: profile?.tenant_id,
        created_by: user.id,
        source_platform: sourcePlatform || 'unknown',
        status: 'draft',
        mode: 'guided',
        session_name: `${sourcePlatform} Migration`,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ sessionId: session.id, session });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
