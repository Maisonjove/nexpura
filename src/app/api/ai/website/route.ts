import { NextRequest, NextResponse } from "next/server";
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

// Input validation
function validateInput(body: unknown): { valid: boolean; error?: string; data?: { sectionType: string; currentContent: Record<string, unknown>; prompt: string; businessInfo?: { name?: string; description?: string } } } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const { sectionType, currentContent, prompt, businessInfo } = body as Record<string, unknown>;

  if (!sectionType || typeof sectionType !== "string") {
    return { valid: false, error: "Section type is required" };
  }

  if (!prompt || typeof prompt !== "string") {
    return { valid: false, error: "Prompt is required" };
  }

  if (prompt.length > 2000) {
    return { valid: false, error: "Prompt is too long (max 2000 characters)" };
  }

  const validSectionTypes = ["hero", "text", "image_text", "gallery", "product_grid", "collection_grid", "testimonials", "contact_form", "enquiry_form", "repair_form", "appointment_form", "policies", "faq", "divider"];
  if (!validSectionTypes.includes(sectionType)) {
    return { valid: false, error: "Invalid section type" };
  }

  return {
    valid: true,
    data: {
      sectionType,
      currentContent: (currentContent as Record<string, unknown>) || {},
      prompt: prompt.trim(),
      businessInfo: businessInfo as { name?: string; description?: string } | undefined,
    },
  };
}

export const POST = withSentryFlush(async (req: NextRequest) => {
  // SECURITY: Require authentication
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success: rlSuccess } = await checkRateLimit(ip);
  if (!rlSuccess) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const validation = validateInput(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { sectionType, currentContent, prompt, businessInfo } = validation.data;

    // Sanitize business info
    const safeName = (businessInfo?.name || "a jewellery store").slice(0, 200);
    const safeDesc = (businessInfo?.description || "a fine jewellery store").slice(0, 500);

    const systemPrompt = `You are an expert jewellery website copywriter and designer. You help jewellery store owners improve their website sections with elegant, professional copy that appeals to fine jewellery customers.

Business context:
- Business name: ${safeName}
- Description: ${safeDesc}

You are editing a "${sectionType}" section. The current content is:
${JSON.stringify(currentContent, null, 2)}

Return ONLY valid JSON with the same structure as the current content, but with improvements based on the user's request. Do not include any explanation or markdown. Return only the raw JSON object.`;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      });

      clearTimeout(timeoutId);

      const text = response.choices[0]?.message?.content || "";
      
      if (!text.trim()) {
        return NextResponse.json({ error: "AI returned an empty response. Please try again." }, { status: 500 });
      }

      // Parse the JSON response
      let suggestedContent: Record<string, unknown>;
      try {
        // Strip markdown code blocks if present
        const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
        suggestedContent = JSON.parse(cleaned) as Record<string, unknown>;
      } catch {
        logger.error("AI website route: Failed to parse response:", text);
        return NextResponse.json({ error: "AI generated an invalid response. Please try a different prompt." }, { status: 500 });
      }

      return NextResponse.json({ suggestedContent });
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json({ error: "AI request timed out. Please try again with a simpler prompt." }, { status: 504 });
      }
      throw err;
    }
  } catch (err) {
    logger.error("AI website route error:", err);
    
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
