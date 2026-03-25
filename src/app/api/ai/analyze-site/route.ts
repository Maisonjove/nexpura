import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

interface AnalyzedPage {
  title: string;
  slug: string;
  sections: Array<{ type: string; contentSummary: string }>;
}

interface SiteAnalysis {
  pages: AnalyzedPage[];
  brandColors: string[];
  businessType: string;
  businessDescription: string;
}

export async function POST(req: NextRequest) {
  const _ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success: _rlSuccess } = await checkRateLimit(_ip);
  if (!_rlSuccess) {
    return new Response("Too many requests", { status: 429 });
  }

  try {
    const body = await req.json() as { url: string; platform: string };
    const { url, platform } = body;

    const prompt = `Based on this jewellery store website URL "${url}" built on ${platform}, describe what pages and sections they likely have. This is a professional jewellery store.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "pages": [
    {
      "title": "Home",
      "slug": "home",
      "sections": [
        {"type": "hero", "contentSummary": "Main hero with jewellery imagery"},
        {"type": "product_grid", "contentSummary": "Featured collection showcase"}
      ]
    }
  ],
  "brandColors": ["#8B7355", "#1A1A1A"],
  "businessType": "Fine Jewellery",
  "businessDescription": "A fine jewellery store specialising in handcrafted pieces"
}

Section types available: hero, text, image_text, gallery, product_grid, collection_grid, testimonials, contact_form, faq, divider

Include realistic pages: Home (with hero, product grid, about snippet, testimonials), About, Contact, Collections/Catalogue, Policies. Add pages based on what a ${platform} jewellery store would typically have.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content || "";
    
    let analysis: SiteAnalysis;
    try {
      const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      analysis = JSON.parse(cleaned) as SiteAnalysis;
    } catch {
      // Return a default structure if parsing fails
      analysis = {
        pages: [
          { title: "Home", slug: "home", sections: [{ type: "hero", contentSummary: "Welcome hero section" }, { type: "product_grid", contentSummary: "Featured products" }] },
          { title: "About", slug: "about", sections: [{ type: "text", contentSummary: "About the business" }] },
          { title: "Contact", slug: "contact", sections: [{ type: "contact_form", contentSummary: "Contact form" }] },
        ],
        brandColors: ["#8B7355", "#1A1A1A"],
        businessType: "Fine Jewellery",
        businessDescription: "A fine jewellery store",
      };
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    logger.error("Analyze site route error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
