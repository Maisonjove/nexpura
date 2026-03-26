import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// Maximum image size: 4 MB (OpenAI recommends ≤ 4 MB for vision)
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "heavy");
  if (!success) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

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

    // Validate image size
    const imageBytes = Buffer.from(imageBase64, "base64").length;
    if (imageBytes > MAX_IMAGE_BYTES) {
      return Response.json({
        error: `Image too large (${(imageBytes / 1024 / 1024).toFixed(1)} MB). Please use an image under 4 MB.`
      }, { status: 400 });
    }

    const { data: stocktakeItems } = await admin
      .from("stocktake_items")
      .select("id, item_name, sku, barcode_value, expected_qty")
      .eq("stocktake_id", stocktakeId)
      .eq("tenant_id", tenantId);

    // If stocktake has no items yet, auto-discover from full inventory
    let itemsSource: Array<{ id: string; item_name: string; sku?: string | null; barcode_value?: string | null }> = [];
    let isFullInventoryFallback = false;

    if (!stocktakeItems || stocktakeItems.length === 0) {
      const { data: inventoryItems } = await admin
        .from("inventory")
        .select("id, name, sku, barcode_value")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .limit(200);

      if (!inventoryItems || inventoryItems.length === 0) {
        return Response.json({ error: "No items found. Please add items to your stocktake or ensure you have inventory records." }, { status: 400 });
      }

      itemsSource = inventoryItems.map((inv) => ({
        id: inv.id,
        item_name: inv.name,
        sku: inv.sku,
        barcode_value: inv.barcode_value,
      }));
      isFullInventoryFallback = true;
    } else {
      itemsSource = stocktakeItems.map((item) => ({
        id: item.id,
        item_name: item.item_name,
        sku: item.sku,
        barcode_value: item.barcode_value,
      }));
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const itemList = itemsSource.map(function(item) {
      return "- ID: " + item.id + " | Name: " + item.item_name +
        (item.sku ? " | SKU: " + item.sku : "") +
        (item.barcode_value ? " | Barcode: " + item.barcode_value : "");
    }).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
          {
            type: "text",
            text: `You are a jewellery inventory assistant. Analyse this photo and identify visible items.

Known items in this stocktake:
${itemList}

Instructions:
1. Identify items visible in the photo
2. Match them to the known items list above by name, SKU, or barcode
3. Estimate a confidence score (0-100) for each match
4. Return ONLY valid JSON array, no prose

Return format:
[{"id":"<item_id>","item_name":"<matched_name>","quantity":<number>,"confidence":<0-100>,"match_reason":"<brief reason>"}]

- confidence 90-100: very clear match (barcode visible or exact name)
- confidence 70-89: likely match (partial name, similar description)  
- confidence 50-69: possible match (general category match)
- confidence below 50: uncertain — omit from results`
          }
        ]
      }]
    });

    const text = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return Response.json({ matches: [] });

    interface RawMatch {
      id: string;
      item_name: string;
      quantity: number;
      confidence?: number;
      match_reason?: string;
    }

    const parsed = JSON.parse(jsonMatch[0]) as RawMatch[];
    const validIds = new Set(itemsSource.map(function(i) { return i.id; }));
    const matches = parsed
      .filter(function(m) { return validIds.has(m.id); })
      .map(function(m) {
        return {
          id: m.id,
          item_name: m.item_name,
          quantity: Math.max(1, Math.round(Number(m.quantity) || 1)),
          confidence: Math.min(100, Math.max(0, Math.round(Number(m.confidence) || 75))),
          match_reason: m.match_reason || "",
          low_confidence: (Number(m.confidence) || 75) < 70,
          from_inventory: isFullInventoryFallback,
        };
      });
    return Response.json({ matches, from_inventory: isFullInventoryFallback });
  } catch (error) {
    logger.error("Photo scan error:", error);
    return Response.json({ error: "Failed to analyse photo" }, { status: 500 });
  }
}
