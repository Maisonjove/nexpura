import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

const AI_TIMEOUT_MS = 30000; // 30 second timeout

function getOpenAI() {
  return new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    timeout: AI_TIMEOUT_MS,
  });
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

const VALID_ACTIONS = ["suggest_tagline", "write_about", "generate_seo", "suggest_colors", "improve_content"];

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success: rlSuccess } = await checkRateLimit(ip);
  if (!rlSuccess) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please log in to use AI features" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { action, currentConfig } = body as { action: string; currentConfig: Record<string, unknown> };

    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const promptFn = ACTION_PROMPTS[action];
    if (!promptFn) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Sanitize current config to prevent prompt injection
    const safeConfig: Record<string, unknown> = {};
    if (currentConfig && typeof currentConfig === "object") {
      for (const [key, value] of Object.entries(currentConfig)) {
        if (typeof value === "string") {
          safeConfig[key] = value.slice(0, 1000); // Limit string lengths
        } else if (typeof value === "number" || typeof value === "boolean") {
          safeConfig[key] = value;
        }
      }
    }

    const prompt = promptFn(safeConfig);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 512,
        messages: [
          { role: "system", content: "You are a helpful AI assistant for a jewellery business management platform. Always return valid JSON only, no markdown, no code fences." },
          { role: "user", content: prompt },
        ],
      });

      clearTimeout(timeoutId);

      const text = response.choices[0]?.message?.content || "{}";
      
      if (!text.trim()) {
        return NextResponse.json({ error: "AI returned an empty response. Please try again." }, { status: 500 });
      }

      const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

      let result: Record<string, unknown>;
      try {
        result = JSON.parse(cleaned) as Record<string, unknown>;
      } catch {
        logger.error("AI site-action: Failed to parse response:", text);
        return NextResponse.json({ error: "AI generated an invalid response. Please try again." }, { status: 500 });
      }

      // Map action result to suggestedConfig
      let suggestedConfig: Record<string, unknown> = {};
      switch (action) {
        case "suggest_tagline":
          // Validate suggestions array
          if (!Array.isArray(result.suggestions) || result.suggestions.length === 0) {
            return NextResponse.json({ error: "AI did not generate any tagline suggestions. Please try again." }, { status: 500 });
          }
          return NextResponse.json({ suggestions: result.suggestions.slice(0, 5), action });
        case "write_about":
          if (!result.about_text || typeof result.about_text !== "string") {
            return NextResponse.json({ error: "AI did not generate about text. Please try again." }, { status: 500 });
          }
          suggestedConfig = { about_text: result.about_text };
          break;
        case "generate_seo":
          suggestedConfig = { 
            meta_title: (result.meta_title as string || "").slice(0, 70),
            meta_description: (result.meta_description as string || "").slice(0, 170),
          };
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
      clearTimeout(timeoutId);
      
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json({ error: "AI request timed out. Please try again." }, { status: 504 });
      }
      throw err;
    }
  } catch (err) {
    logger.error("AI site-action error:", err);
    
    // Check for specific OpenAI errors
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) {
        return NextResponse.json({ error: "AI service is busy. Please try again in a moment." }, { status: 429 });
      }
      if (err.status === 503) {
        return NextResponse.json({ error: "AI service is temporarily unavailable. Please try again later." }, { status: 503 });
      }
    }
    
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 500 });
  }
});
