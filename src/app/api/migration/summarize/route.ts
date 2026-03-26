import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, tenantId } = await req.json();

    const admin = createAdminClient();

    // Get session + files
    const { data: session } = await admin
      .from('migration_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    const { data: files } = await admin
      .from('migration_files')
      .select('*')
      .eq('session_id', sessionId);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const fallbackSummary = {
        understanding: `Migration from ${session?.source_platform || 'unknown'} with ${files?.length || 0} files uploaded.`,
        risks: [],
        suggestions: ['Review field mappings carefully', 'Check for duplicate customers before importing'],
        confidence: 0.5,
      };
      await admin.from('migration_sessions').update({ ai_summary: fallbackSummary }).eq('id', sessionId);
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

    await admin.from('migration_sessions').update({ ai_summary: summary }).eq('id', sessionId);

    return NextResponse.json({ summary });
  } catch (err) {
    logger.error('Summarize error:', err);
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}
