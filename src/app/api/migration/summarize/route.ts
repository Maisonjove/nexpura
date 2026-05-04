import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  // SECURITY: Require authentication
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await checkRateLimit(ip, 'heavy');
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const admin = createAdminClient();

    // SECURITY: Get tenant from authenticated user, NOT from request body
    const { data: userData } = await admin
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!userData?.tenant_id) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }
    const tenantId = userData.tenant_id;

    const { sessionId } = await req.json();

    // SECURITY: Verify session belongs to user's tenant
    const { data: session } = await admin
      .from('migration_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data: files } = await admin
      .from('migration_files')
      .select('*')
      .eq('session_id', sessionId)
      .eq('tenant_id', tenantId);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const fallbackSummary = {
        understanding: `Migration from ${session?.source_platform || 'unknown'} with ${files?.length || 0} files uploaded.`,
        risks: [],
        suggestions: ['Review field mappings carefully', 'Check for duplicate customers before importing'],
        confidence: 0.5,
      };
      await admin.from('migration_sessions').update({ ai_summary: fallbackSummary }).eq('id', sessionId).eq('tenant_id', tenantId);
      return NextResponse.json({ summary: fallbackSummary });
    }

    const filesStr = (files || []).map(f =>
      `- ${f.original_name}: ${f.detected_entity} from ${f.detected_platform || 'unknown'}, ${f.row_count || 0} rows, confidence ${Math.round((f.confidence_score || 0) * 100)}%`
    ).join('\n');

    const prompt = `You are reviewing a jewellery POS migration for a Nexpura customer.

Platform: ${session?.source_platform}
Files:
${filesStr}

Write a concise migration summary. Return JSON:
{
  "understanding": "2-3 sentence summary of what was understood",
  "risks": ["risk 1", "risk 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "confidence": 0.0-1.0,
  "overall": "One sentence overall assessment"
}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a jewellery data migration expert. Return valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);

    const aiData = await res.json();
    const summary = JSON.parse(aiData.choices[0].message.content);

    await admin.from('migration_sessions').update({ ai_summary: summary }).eq('id', sessionId).eq('tenant_id', tenantId);

    return NextResponse.json({ summary });
  } catch (err) {
    logger.error('Summarize error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 200 });
  }
});
