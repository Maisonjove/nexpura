import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const ACTION_PROMPTS: Record<string, (cfg: Record<string, unknown>) => string> = {
  suggest_tagline: (cfg) =>
    `You are a luxury jewellery copywriter. Write 3 short taglines (under 10 words each) for a jewellery business called "${cfg.business_name || "this jewellery store"}". The current tagline is: "${cfg.tagline || "none"}". Return JSON: {"suggestions": ["...", "...", "..."]}`,

  write_about: (cfg) =>
    `You are a luxury jewellery copywriter. Write a compelling "About Us" paragraph (2-3 sentences, 60-80 words) for "${cfg.business_name || "a fine jewellery boutique"}". Tone: warm, craft-focused, elegant. Return JSON: {"about_text": "..."}`,

  generate_seo: (cfg) =>
    `You are an SEO expert specialising in luxury retail. Generate a meta_title (under 60 chars) and meta_description (under 160 chars) for a jewellery business called "${cfg.business_name || "a jewellery store"}" with tagline "${cfg.tagline || ""}". Return JSON: {"meta_title": "...", "meta_description": "..."}`,

  suggest_colors: (cfg) =>
    `You are a luxury brand designer. Suggest a primary and secondary hex color for a jewellery business called "${cfg.business_name || "this jewellery store"}". The current primary is "${cfg.primary_color || "#8B7355"}". Choose elegant, timeless palette. Return JSON: {"primary_color": "#hex", "secondary_color": "#hex", "rationale": "1 sentence"}`,

  improve_content: (cfg) =>
    `You are a luxury jewellery copywriter. Review and improve the following website content for "${cfg.business_name || "a jewellery store"}":
About: ${cfg.about_text || "none"}
Tagline: ${cfg.tagline || "none"}
Return improved versions as JSON: {"tagline": "...", "about_text": "..."}`,
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { action: string; currentConfig: Record<string, unknown> };
    const { action, currentConfig } = body;

    const promptFn = ACTION_PROMPTS[action];
    if (!promptFn) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const prompt = promptFn(currentConfig);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      messages: [
        { role: "system", content: "You are a helpful AI assistant for a jewellery business management platform. Always return valid JSON only, no markdown, no code fences." },
        { role: "user", content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content || "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
    }

    // Map action result to suggestedConfig
    let suggestedConfig: Record<string, unknown> = {};
    switch (action) {
      case "suggest_tagline":
        // Return suggestions array for the client to pick from
        return NextResponse.json({ suggestions: result.suggestions, action });
      case "write_about":
        suggestedConfig = { about_text: result.about_text };
        break;
      case "generate_seo":
        suggestedConfig = { meta_title: result.meta_title, meta_description: result.meta_description };
        break;
      case "suggest_colors":
        suggestedConfig = { primary_color: result.primary_color, secondary_color: result.secondary_color };
        return NextResponse.json({ suggestedConfig, rationale: result.rationale, action });
      case "improve_content":
        suggestedConfig = { tagline: result.tagline, about_text: result.about_text };
        break;
    }

    return NextResponse.json({ suggestedConfig, action });
  } catch (err) {
    console.error("AI site-action error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
