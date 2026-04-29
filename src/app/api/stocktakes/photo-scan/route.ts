import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { reportServerError } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return Response.json({ error: "No tenant" }, { status: 401 });
    }

    const tenantId = userData.tenant_id;

    const body = await request.json();
    const { imageBase64, mimeType, stocktakeId } = body;

    if (!imageBase64 || !stocktakeId) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch stocktake items for context
    const { data: stocktakeItems } = await admin
      .from("stocktake_items")
      .select("id, item_name, sku, barcode_value, expected_qty")
      .eq("stocktake_id", stocktakeId)
      .eq("tenant_id", tenantId);

    if (!stocktakeItems || stocktakeItems.length === 0) {
      return Response.json(
        { error: "No items found in this stocktake" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const itemList = stocktakeItems
      .map(
        (item) =>
          `- ID: ${item.id} | Name: ${item.item_name}${item.sku ? ` | SKU: ${item.sku}` : ""}${item.barcode_value ? ` | Barcode: ${item.barcode_value}` : ""}`
      )
      .join("\n");

    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ] as const;
    type ValidMimeType = (typeof validMimeTypes)[number];
    const safeMimeType: ValidMimeType = validMimeTypes.includes(
      mimeType as ValidMimeType
    )
      ? (mimeType as ValidMimeType)
      : "image/jpeg";

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: safeMimeType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `You are a jewellery inventory assistant. Carefully analyse this photo and identify any jewellery items visible.

Here are the items currently in this stocktake:
${itemList}

Instructions:
1. Look carefully at every item visible in the photo
2. Match what you see to items from the list above based on appearance, name, or visible labels/tags
3. Count the quantity of each matched item visible
4. Return ONLY a valid JSON array — no other text, no markdown

Required JSON format:
[{"id": "<stocktake_item_id>", "item_name": "<name>", "quantity": <number>}]

If no items can be matched, return an empty array: []`,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return Response.json({ matches: [] });
    }

    try {
      const text = content.text.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return Response.json({ matches: [] });
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate matches against actual stocktake item IDs
      const validIds = new Set(stocktakeItems.map((i) => i.id));
      const matches = parsed
        .filter((m: { id: string }) => validIds.has(m.id))
        .map((m: { id: string; item_name: string; quantity: number }) => ({
          id: m.id,
          item_name: m.item_name,
          quantity: Math.max(1, Math.round(Number(m.quantity) || 1)),
        }));

      return Response.json({ matches });
    } catch {
      return Response.json({ matches: [] });
    }
  } catch (error) {
    reportServerError("stocktakes/photo-scan:POST", error);

    // Differentiate billing/auth/rate-limit errors so the UI can show the
    // jeweller a useful message instead of "Failed to analyse photo" — which
    // makes them think their photo is bad when really it's a service-side issue.
    if (error instanceof Anthropic.APIError) {
      const status = error.status;
      const msg = String(error.message ?? "");
      if (status === 401 || (status === 400 && /credit balance/i.test(msg))) {
        return Response.json(
          {
            error:
              "AI photo scan is temporarily unavailable. Please try again shortly or contact support.",
            code: "service_unavailable",
          },
          { status: 503 }
        );
      }
      if (status === 429) {
        return Response.json(
          {
            error:
              "Too many photo scans in a short time. Please wait a moment and try again.",
            code: "rate_limited",
          },
          { status: 429 }
        );
      }
    }

    return Response.json(
      {
        error: "Couldn't analyse this photo. Please try a clearer image.",
        code: "analysis_failed",
      },
      { status: 500 }
    );
  }
}
