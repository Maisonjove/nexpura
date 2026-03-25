import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";
import logger from "@/lib/logger";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient();
    const { data: userData } = await admin.from("users").select("tenant_id").eq("id", user.id).single();
    if (!userData?.tenant_id) return Response.json({ error: "No tenant" }, { status: 401 });

    const tenantId = userData.tenant_id;
    const body = await request.json();
    const { imageBase64, mimeType, stocktakeId } = body;
    if (!imageBase64 || !stocktakeId) return Response.json({ error: "Missing required fields" }, { status: 400 });

    const { data: stocktakeItems } = await admin
      .from("stocktake_items")
      .select("id, item_name, sku, barcode_value, expected_qty")
      .eq("stocktake_id", stocktakeId)
      .eq("tenant_id", tenantId);

    if (!stocktakeItems || stocktakeItems.length === 0)
      return Response.json({ error: "No items found in this stocktake" }, { status: 400 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const itemList = stocktakeItems.map(function(item) {
      return "- ID: " + item.id + " | Name: " + item.item_name +
        (item.sku ? " | SKU: " + item.sku : "") +
        (item.barcode_value ? " | Barcode: " + item.barcode_value : "");
    }).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
          { type: "text", text: "You are a jewellery inventory assistant. Analyse this photo and identify visible items.\n\nItems:\n" + itemList + "\n\nReturn ONLY JSON: [{\"id\":\"<id>\",\"item_name\":\"<name>\",\"quantity\":<number>}]" }
        ]
      }]
    });

    const text = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return Response.json({ matches: [] });

    const parsed = JSON.parse(jsonMatch[0]);
    const validIds = new Set(stocktakeItems.map(function(i) { return i.id; }));
    const matches = parsed
      .filter(function(m: { id: string }) { return validIds.has(m.id); })
      .map(function(m: { id: string; item_name: string; quantity: number }) {
        return {
          id: m.id,
          item_name: m.item_name,
          quantity: Math.max(1, Math.round(Number(m.quantity) || 1)),
        };
      });
    return Response.json({ matches });
  } catch (error) {
    logger.error("Photo scan error:", error);
    return Response.json({ error: "Failed to analyse photo" }, { status: 500 });
  }
}
