import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

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

export const POST = withSentryFlush(async (req: NextRequest) => {
  // SECURITY: Require authentication
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await checkRateLimit(ip, 'heavy');
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const admin = createAdminClient();

    // SECURITY: Get tenant from authenticated user, NOT from request body
    const { data: userData } = await admin
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!userData?.tenant_id) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }
    const tenantId = userData.tenant_id;

    const { fileId, fileName, headers, sampleRows, sessionId } = await req.json();

    // SECURITY: Verify file belongs to user's tenant
    const { data: file } = await admin
      .from('migration_files')
      .select('id')
      .eq('id', fileId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Degrade gracefully
      // Kind B (server-action-style, destructive return-error). The
      // operator needs to know the file failed to classify so they can
      // act. If the status flip itself fails, the file is silently
      // stuck in whatever status it was — surface 500 over a fake-OK.
      const { error: degradeErr } = await admin.from('migration_files').update({
        status: 'needs_review',
        classification_notes: 'AI classification unavailable — please review manually',
      }).eq('id', fileId).eq('tenant_id', tenantId);
      if (degradeErr) {
        return NextResponse.json(
          { error: `migration_files needs_review flip failed: ${degradeErr.message}` },
          { status: 500 },
        );
      }
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

    // Update the file record (reuse admin client from earlier)
    // Kind B (server-action-style, destructive return-error). The
    // classification result is the file's only persistent record of the
    // AI's analysis — without this UPDATE the migration UI keeps
    // showing "classifying..." while the OpenAI cost has already been
    // burned. Surface 500 so the operator retries (the OpenAI call is
    // idempotent enough that the next try will land in the same spot).
    const { error: classifyUpdErr } = await admin.from('migration_files').update({
      detected_entity: result.detectedEntity,
      detected_platform: result.detectedPlatform,
      confidence_score: result.confidence,
      status: result.confidence >= 0.6 ? 'classified' : 'needs_review',
      classification_notes: result.reasoning,
    }).eq('id', fileId).eq('tenant_id', tenantId);
    if (classifyUpdErr) {
      return NextResponse.json(
        { error: `migration_files classification update failed: ${classifyUpdErr.message}` },
        { status: 500 },
      );
    }

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

      // Kind B (server-action-style, destructive return-error). The
      // suggested mappings are the heart of the classification — the
      // UI's mapping editor reads from this row. If the upsert silently
      // fails the operator gets a successful-looking classify response
      // with no mapping suggestions to edit.
      const { error: mappingsUpsertErr } = await admin.from('migration_mappings').upsert({
        tenant_id: tenantId,
        session_id: sessionId,
        file_id: fileId,
        entity_type: result.detectedEntity,
        mappings,
      });
      if (mappingsUpsertErr) {
        return NextResponse.json(
          { error: `migration_mappings upsert failed: ${mappingsUpsertErr.message}` },
          { status: 500 },
        );
      }
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
    // Degrade gracefully
    try {
      const { fileId } = await req.json().catch(() => ({} as { fileId?: string }));
      if (fileId) {
        const admin = createAdminClient();
        // Kind C (best-effort observability log+continue). We're already
        // in the outer catch — the route is about to return 200 with
        // status: 'needs_review' as a degraded-graceful path. If THIS
        // status flip itself errors, log it; the empty catch around this
        // block was already swallowing it. The row stays in classifying
        // state; ops will see the error and retry the classify.
        const { error: degradeErr } = await admin.from('migration_files').update({
          status: 'needs_review',
          classification_notes: 'Classification failed — please review manually',
        }).eq('id', fileId);
        if (degradeErr) {
          logger.error('[migration/classify] graceful-degrade status flip failed; file stuck in classifying state', {
            fileId,
            err: degradeErr,
          });
        }
      }
    } catch {}
    // P2-A Item 9 + 10: preserve the unusual { error, status } shape
    // because the wizard UI is contract-bound to it (a 200 with status:
    // 'needs_review' triggers the manual-review tab). Replace the raw
    // err.message echo with a generic operator-facing string — internal
    // OpenAI / SDK error text shouldn't leak.
    return NextResponse.json(
      { error: 'Classification failed — please review manually', status: 'needs_review' },
      { status: 200 },
    );
  }
});
