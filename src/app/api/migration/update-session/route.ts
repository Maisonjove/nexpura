import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, status, dataScope, ...rest } = await req.json();
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
