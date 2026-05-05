import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from "@/lib/rate-limit";
import { reportServerError } from "@/lib/logger";

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
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('migration_whiteglov_requests')
      .insert({
        tenant_id: profile?.tenant_id,
        user_id: user.id,
        source_platform: body.source_platform,
        estimated_records: body.estimated_records,
        notes: body.notes,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        status: 'submitted',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ request: data, success: true });
  } catch (err) {
    // P2-A Item 9: log full err, return generic message.
    reportServerError("migration/assisted-request:POST", err);
    return NextResponse.json({ error: "Assisted-migration request failed" }, { status: 500 });
  }
}
