import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { migrationUpdateSessionSchema } from '@/lib/schemas';
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

    const body = await req.json();
    const parseResult = migrationUpdateSessionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { sessionId, status, dataScope, ...rest } = parseResult.data;
    const admin = createAdminClient();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (dataScope) updateData.data_scope = dataScope;
    Object.assign(updateData, rest);

    const { data, error } = await admin
      .from('migration_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ session: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
