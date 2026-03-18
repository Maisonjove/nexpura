"use server";

import OpenAI from "openai";

export interface ExtractedItem {
  description: string;
  quantity: number;
  cost_price: number;
  sku: string | null;
}

export interface InvoiceParseResult {
  supplier_name: string | null;
  items: ExtractedItem[];
  raw_response?: string;
}

export interface ParseInvoiceResult {
  success: boolean;
  data?: InvoiceParseResult;
  error?: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function parseInvoiceImage(base64Image: string): Promise<ParseInvoiceResult> {
  try {
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting structured data from supplier invoices for a jewelry business.
          
Your task is to analyze invoice images and extract:
1. The supplier name (company name on the invoice)
2. All line items with their details

For each item, extract:
- description: A clear description of the item (jewelry piece description, metal type, stone details if visible)
- quantity: Number of items (default to 1 if not clearly specified)
- cost_price: The cost/unit price (NOT the total, the per-item price). Parse currency symbols and convert to number.
- sku: Product code, SKU, or reference number if visible (null if not found)

Important:
- If you see a total line amount, divide by quantity to get unit price
- Remove currency symbols from prices and convert to decimal numbers
- If the invoice is unclear or you can't extract items, return an empty items array
- Be thorough - extract ALL line items from the invoice
- For jewelry invoices, look for item codes, descriptions, weights, and prices

Return your response as valid JSON only, no markdown or explanation.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all items from this supplier invoice. Return ONLY valid JSON in this exact format:
{
  "supplier_name": "Company Name or null",
  "items": [
    {
      "description": "Item description",
      "quantity": 1,
      "cost_price": 100.00,
      "sku": "SKU123 or null"
    }
  ]
}`,
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image.startsWith("data:") ? base64Image : `data:image/jpeg;base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    // Try to parse the JSON response
    try {
      // Clean up the response - sometimes GPT wraps in markdown
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr) as InvoiceParseResult;
      
      // Validate and clean the data
      const cleanedItems: ExtractedItem[] = (parsed.items || []).map((item) => ({
        description: String(item.description || "Unknown item"),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        cost_price: Math.max(0, Number(item.cost_price) || 0),
        sku: item.sku ? String(item.sku) : null,
      }));

      return {
        success: true,
        data: {
          supplier_name: parsed.supplier_name || null,
          items: cleanedItems,
          raw_response: content,
        },
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return {
        success: false,
        error: "Failed to parse invoice data. Please try again or enter items manually.",
      };
    }
  } catch (error) {
    console.error("Invoice parsing error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return { success: false, error: "AI service configuration error. Please contact support." };
      }
      if (error.message.includes("rate limit")) {
        return { success: false, error: "Too many requests. Please wait a moment and try again." };
      }
      return { success: false, error: error.message };
    }
    
    return { success: false, error: "Failed to process invoice image" };
  }
}
