import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sectionType: string;
      currentContent: Record<string, unknown>;
      prompt: string;
      businessInfo?: { name?: string; description?: string };
    };

    const { sectionType, currentContent, prompt, businessInfo } = body;

    const systemPrompt = `You are an expert jewellery website copywriter and designer. You help jewellery store owners improve their website sections with elegant, professional copy that appeals to fine jewellery customers.

Business context:
- Business name: ${businessInfo?.name || "a jewellery store"}
- Description: ${businessInfo?.description || "a fine jewellery store"}

You are editing a "${sectionType}" section. The current content is:
${JSON.stringify(currentContent, null, 2)}

Return ONLY valid JSON with the same structure as the current content, but with improvements based on the user's request. Do not include any explanation or markdown. Return only the raw JSON object.`;

    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      system: systemPrompt,
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    
    // Parse the JSON response
    let suggestedContent: Record<string, unknown>;
    try {
      // Strip markdown code blocks if present
      const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      suggestedContent = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return NextResponse.json({ suggestedContent });
  } catch (err) {
    console.error("AI website route error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
