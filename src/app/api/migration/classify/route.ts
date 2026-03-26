import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const NEXPURA_SCHEMA = `
Customers: full_name, first_name, last_name, email, phone, mobile, address_line1, city, state, postcode, country, ring_size, bracelet_size, notes, date_of_birth, anniversary, store_credit, loyalty_points, created_at
Inventory: sku, name, description, category, metal_type, metal_colour, carat, stone_type, stone_weight, cost_price, retail_price, stock_qty, barcode, supplier, location, weight_grams, serial_number, brand, status
Repairs: customer_name, item_description, job_description, status, due_date, price, notes, created_at, completed_at, technician
Invoices: invoice_number, customer_name, total, status, date, due_date, notes
Payments: amount, payment_method, date, reference, customer_name
Bespoke: customer_name, description, metal_type, stone_type, carat, due_date, price, deposit, status, notes
`;

const PLATFORM_HINTS: Record<string, string> = {
  swim: 'Swim columns often: Customer Name, Mobile, Ring Size, Balance, Loyalty Points',
  jewel360: 'Jewel360: Item Number, Vendor, Metal Purity, Style Number',
  wjewel: 'WJewel: Cust No, First Name, Last Name, Street, Suburb, Postcode',
  shopify: 'Shopify: First Name, Last Name, Email, Total Orders, Total Spent',
  lightspeed: 'Lightspeed: Item Description, Vendor SKU, Qty on Hand, Price',
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await checkRateLimit(ip, 'heavy');
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const { fileId, fileName, headers, sampleRows, tenantId, sessionId } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Degrade gracefully
      const admin = createAdminClient();
      await admin.from('migration_files').update({
        status: 'needs_review',
        classification_notes: 'AI classification unavailable — please review manually',
      }).eq('id', fileId);
      return NextResponse.json({ status: 'needs_review' });
    }

    const headerStr = headers.join(', ');
    const sampleStr = sampleRows.slice(0, 5).map((row: string[]) => row.join(', ')).join('\n');

    const prompt = `You are a jewellery POS data migration expert. Analyse this CSV export and classify it.

File name: ${fileName}
Column headers: ${headerStr}
Sample rows:
${sampleStr}

Nexpura schema:
${NEXPURA_SCHEMA}

Known platform hints:
${Object.entries(PLATFORM_HINTS).map(([k, v]) => `${k}: ${v}`).join('\n')}

Return JSON with:
{
  "detectedEntity": "customers|inventory|repairs|invoices|payments|bespoke|settings|unknown",
  "detectedPlatform": "swim|jewel360|wjewel|shopify|lightspeed|square|woocommerce|vend|quickbooks|csv_excel|unknown",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggestedMappings": [
    { "sourceColumn": "...", "destinationField": "...", "confidence": 0.0-1.0, "transformation": null|"description", "warning": null|"warning text", "status": "auto|review" }
  ],
  "missingRequiredFields": ["field1"],
  "warnings": ["warning1"],
  "rowCount": null
}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a jewellery data migration specialist. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);

    const aiData = await res.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const admin = createAdminClient();

    // Update the file record
    await admin.from('migration_files').update({
      detected_entity: result.detectedEntity,
      detected_platform: result.detectedPlatform,
      confidence_score: result.confidence,
      status: result.confidence >= 0.6 ? 'classified' : 'needs_review',
      classification_notes: result.reasoning,
    }).eq('id', fileId);

    // Create mapping record
    if (result.suggestedMappings && result.suggestedMappings.length > 0) {
      interface SuggestedMapping {
        sourceColumn: string;
        destinationField: string;
        confidence: number;
        transformation: string | null;
        warning: string | null;
        status?: string;
      }
      const mappings = result.suggestedMappings.map((m: SuggestedMapping) => ({
        source_col: m.sourceColumn,
        destination_field: m.destinationField,
        confidence: m.confidence,
        transformation: m.transformation,
        warning: m.warning,
        status: m.status || (m.confidence >= 0.8 ? 'auto' : 'review'),
      }));

      await admin.from('migration_mappings').upsert({
        tenant_id: tenantId,
        session_id: sessionId,
        file_id: fileId,
        entity_type: result.detectedEntity,
        mappings,
      });
    }

    return NextResponse.json({
      detected_entity: result.detectedEntity,
      detected_platform: result.detectedPlatform,
      confidence_score: result.confidence,
      status: result.confidence >= 0.6 ? 'classified' : 'needs_review',
      classification_notes: result.reasoning,
      missingRequiredFields: result.missingRequiredFields,
      warnings: result.warnings,
    });
  } catch (err) {
    logger.error('Classification error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    // Degrade gracefully
    try {
      const { fileId } = await req.json().catch(() => ({} as { fileId?: string }));
      if (fileId) {
        const admin = createAdminClient();
        await admin.from('migration_files').update({
          status: 'needs_review',
          classification_notes: 'Classification failed — please review manually',
        }).eq('id', fileId);
      }
    } catch {}
    return NextResponse.json({ error: errorMessage, status: 'needs_review' }, { status: 200 });
  }
}
