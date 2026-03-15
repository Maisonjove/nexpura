import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import DailyTaskDigestEmail from '@/lib/email/templates/DailyTaskDigestEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // Check for auth (cron secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Get all tenants with their timezone
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, timezone');

  if (tenantError || !tenants) {
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }

  const results = [];

  for (const tenant of tenants) {
    const tz = tenant.timezone || 'UTC';
    
    // 2. Check if it's currently 9:00 AM (or between 9:00 and 9:59) in that timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    
    const localHour = parseInt(formatter.format(now), 10);

    if (localHour === 9) {
      // It's 9 AM! Send digests.
      
      // 3. Get all users for this tenant
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('tenant_id', tenant.id);

      if (!users) continue;

      for (const user of users) {
        // 4. Get pending tasks for this user — scoped to this tenant for safety
        const { data: tasks } = await supabase
          .from('staff_tasks')
          .select('id, title, description, priority, due_date, department')
          .eq('tenant_id', tenant.id)
          .eq('assigned_to', user.id)
          .eq('status', 'pending')
          .order('priority', { ascending: false });

        if (tasks && tasks.length > 0) {
          // 5. Send email
          try {
            await resend.emails.send({
              from: 'Nexpura <notifications@nexpura.com>',
              to: user.email,
              subject: `Your Daily Tasks — ${tenant.name}`,
              react: DailyTaskDigestEmail({
                employeeName: user.full_name || 'there',
                tasks: tasks,
                businessName: tenant.name,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tasks`,
              }),
            });
            results.push({ user: user.email, status: 'sent' });
          } catch (e) {
            results.push({ user: user.email, status: 'error', error: e });
          }
        }
      }
    }
  }

  return NextResponse.json({ 
    message: 'Cron processed', 
    processedTime: new Date().toISOString(),
    results 
  });
}
