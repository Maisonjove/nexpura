import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseCSVFull,
  parseXLSXFull,
  applyMappings,
  buildDefaultMappings,
  buildImportMetadata,
  importCustomer,
  importInventory,
  importRepair,
  importBespokeJob,
  findDuplicateCustomer,
  CUSTOMER_DEFAULT_MAPPINGS,
  INVENTORY_DEFAULT_MAPPINGS,
  REPAIR_DEFAULT_MAPPINGS,
  type ImportContext,
  type ImportRow,
  type MappingEntry,
} from '@/lib/migration/engine';

export const runtime = 'nodejs';
// Allow up to 5 minutes for large imports
export const maxDuration = 300;

type EntityType = 'customers' | 'inventory' | 'repairs' | 'bespoke' | 'invoices' | 'payments' | 'unknown';

const ENTITY_ORDER: EntityType[] = ['customers', 'inventory', 'repairs', 'bespoke', 'invoices', 'payments'];

function entitySortKey(e: EntityType): number {
  const idx = ENTITY_ORDER.indexOf(e);
  return idx === -1 ? 99 : idx;
}

interface MigrationFile {
  id: string;
  original_name: string;
  storage_path: string;
  detected_entity: EntityType | null;
  row_count: number | null;
  column_headers: string[] | null;
  migration_mappings?: Array<{ mappings: MappingEntry[] | null }>;
}

interface MigrationSession {
  id: string;
  source_platform: string;
  data_scope: 'active' | 'active_and_recent' | 'full_archive' | null;
  status: string;
}

async function downloadFile(
  admin: ReturnType<typeof createAdminClient>,
  storagePath: string
): Promise<Uint8Array | null> {
  try {
    const { data, error } = await admin.storage
      .from('migration-files')
      .download(storagePath);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function parseFileFromStorage(
  admin: ReturnType<typeof createAdminClient>,
  file: MigrationFile
): Promise<Array<Record<string, unknown>>> {
  const bytes = await downloadFile(admin, file.storage_path);
  if (!bytes) return [];

  const name = file.original_name.toLowerCase();
  if (name.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(bytes);
    const parsed = parseCSVFull(text);
    return parsed.rows;
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const parsed = await parseXLSXFull(bytes);
    return parsed.rows;
  }
  return [];
}

function getMappingsForFile(file: MigrationFile): MappingEntry[] {
  // If we have stored AI mappings, use them
  const storedMappings = file.migration_mappings?.[0]?.mappings;
  if (storedMappings && storedMappings.length > 0) return storedMappings;

  // Fall back to default pattern matching
  const headers = file.column_headers ?? [];
  const entity = (file.detected_entity ?? 'unknown') as EntityType;

  if (entity === 'customers') return buildDefaultMappings(headers, CUSTOMER_DEFAULT_MAPPINGS);
  if (entity === 'inventory') return buildDefaultMappings(headers, INVENTORY_DEFAULT_MAPPINGS);
  if (entity === 'repairs') return buildDefaultMappings(headers, REPAIR_DEFAULT_MAPPINGS);
  if (entity === 'bespoke') return buildDefaultMappings(headers, REPAIR_DEFAULT_MAPPINGS);

  return [];
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = (profile as { tenant_id: string } | null)?.tenant_id;
    const { sessionId } = await req.json() as { sessionId: string };

    // Get session
    const { data: sessionData } = await admin
      .from('migration_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    const session = sessionData as MigrationSession | null;
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Get files with their stored mappings
    const { data: rawFiles } = await admin
      .from('migration_files')
      .select('*, migration_mappings(*)')
      .eq('session_id', sessionId)
      .in('status', ['classified', 'ready', 'pending']);

    const files = (rawFiles ?? []) as MigrationFile[];

    // Sort by entity import order
    const sortedFiles = [...files].sort((a, b) =>
      entitySortKey(a.detected_entity ?? 'unknown') - entitySortKey(b.detected_entity ?? 'unknown')
    );

    const totalRecords = sortedFiles.reduce((sum, f) => sum + (f.row_count || 0), 0);

    // Create migration job record
    const { data: jobData, error: jobError } = await admin
      .from('migration_jobs')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        status: 'running',
        total_records: totalRecords,
        processed_records: 0,
        success_count: 0,
        warning_count: 0,
        error_count: 0,
        skipped_count: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const job = jobData as { id: string };

    // Log start
    await admin.from('migration_logs').insert({
      tenant_id: tenantId,
      session_id: sessionId,
      job_id: job.id,
      actor_id: user.id,
      action: 'job_started',
      details: { total_records: totalRecords, source_platform: session.source_platform },
    });

    const dataScope = session.data_scope ?? 'active_and_recent';
    let processed = 0;
    let success = 0;
    let warnings = 0;
    let errors = 0;
    let skipped = 0;
    let duplicates = 0;

    const byEntity: Record<string, { success: number; error: number; skipped: number; duplicate: number }> = {};

    // ─── Process each file ────────────────────────────────────────────────────

    for (const file of sortedFiles) {
      const entity = (file.detected_entity ?? 'unknown') as EntityType;
      if (!byEntity[entity]) byEntity[entity] = { success: 0, error: 0, skipped: 0, duplicate: 0 };

      const mappings = getMappingsForFile(file);
      const rows = await parseFileFromStorage(admin, file);

      const ctx: ImportContext = {
        tenantId: tenantId!,
        jobId: job.id,
        sessionId,
        sourcePlatform: session.source_platform,
        sourceFileName: file.original_name,
        importUserId: user.id,
        dataScope,
      };

      // Process rows in batches to avoid timeout
      const BATCH_SIZE = 50;
      const jobRecords: Array<Record<string, unknown>> = [];

      for (let i = 0; i < rows.length; i++) {
        const sourceRow = rows[i];
        const rowNum = i + 1;
        const mappedData = applyMappings(sourceRow, mappings);

        const importRow: ImportRow = {
          sourceRowNumber: rowNum,
          sourceData: sourceRow,
          sourceExternalId: String(mappedData.source_id || mappedData.sku || mappedData.repair_number || ''),
        };

        let result: { status: string; recordId?: string; error?: string } = { status: 'skipped' };

        if (entity === 'customers') {
          result = await importCustomer(admin, ctx, importRow, mappedData);
        } else if (entity === 'inventory') {
          result = await importInventory(admin, ctx, importRow, mappedData);
        } else if (entity === 'repairs') {
          // Try to link to a customer
          let customerId: string | undefined;
          if (mappedData.customer_email || mappedData.customer_name) {
            const found = await findDuplicateCustomer(admin, tenantId!, {
              email: mappedData.customer_email as string | undefined,
              full_name: mappedData.customer_name as string | undefined,
            });
            customerId = found ?? undefined;
          }
          result = await importRepair(admin, ctx, importRow, mappedData, customerId);
        } else if (entity === 'bespoke') {
          let customerId: string | undefined;
          if (mappedData.customer_email || mappedData.customer_name) {
            const found = await findDuplicateCustomer(admin, tenantId!, {
              email: mappedData.customer_email as string | undefined,
              full_name: mappedData.customer_name as string | undefined,
            });
            customerId = found ?? undefined;
          }
          result = await importBespokeJob(admin, ctx, importRow, mappedData, customerId);
        } else {
          // Unknown/invoices/payments: record as skipped for now
          result = { status: 'skipped' };
        }

        processed++;
        if (result.status === 'success') { success++; byEntity[entity].success++; }
        else if (result.status === 'duplicate') { duplicates++; byEntity[entity].duplicate++; success++; }
        else if (result.status === 'error') { errors++; byEntity[entity].error++; }
        else if (result.status === 'skipped') { skipped++; byEntity[entity].skipped++; }

        jobRecords.push({
          tenant_id: tenantId,
          job_id: job.id,
          session_id: sessionId,
          source_file_id: file.id,
          entity_type: entity,
          source_row_number: rowNum,
          source_external_id: importRow.sourceExternalId || null,
          destination_record_id: result.recordId || null,
          destination_table: entity === 'customers' ? 'customers'
            : entity === 'inventory' ? 'inventory'
            : entity === 'repairs' ? 'repairs'
            : entity === 'bespoke' ? 'bespoke_jobs' : null,
          status: result.status === 'duplicate' ? 'warning' : result.status,
          error_message: result.error || null,
          warning_message: result.status === 'duplicate' ? `Duplicate — matched existing record ${result.recordId}` : null,
          source_data: { ...sourceRow, _mapped: mappedData },
        });

        // Flush job records in batches
        if (jobRecords.length >= BATCH_SIZE) {
          await admin.from('migration_job_records').insert(jobRecords.splice(0, BATCH_SIZE));
          // Update progress
          await admin.from('migration_jobs').update({
            processed_records: processed,
            success_count: success,
            error_count: errors,
            skipped_count: skipped,
          }).eq('id', job.id);
        }
      }

      // Flush remaining
      if (jobRecords.length > 0) {
        await admin.from('migration_job_records').insert(jobRecords);
      }

      // Mark file as imported
      await admin.from('migration_files').update({ status: 'imported' }).eq('id', file.id);
    }

    // Final job update
    const finalStatus = errors > 0 && success === 0 ? 'failed' : errors > 0 ? 'complete_with_errors' : 'complete';
    await admin.from('migration_jobs').update({
      status: finalStatus,
      processed_records: processed,
      success_count: success,
      warning_count: warnings + duplicates,
      error_count: errors,
      skipped_count: skipped,
      completed_at: new Date().toISOString(),
      results_summary: {
        by_entity: byEntity,
        total_processed: processed,
        total_success: success,
        total_errors: errors,
        total_skipped: skipped,
        total_duplicates: duplicates,
      },
    }).eq('id', job.id);

    // Update session
    await admin.from('migration_sessions').update({
      status: 'complete',
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId);

    // Log completion
    await admin.from('migration_logs').insert({
      tenant_id: tenantId,
      session_id: sessionId,
      job_id: job.id,
      actor_id: user.id,
      action: 'job_complete',
      details: {
        success_count: success,
        warning_count: warnings,
        error_count: errors,
        skipped_count: skipped,
        duplicate_count: duplicates,
        by_entity: byEntity,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      success: true,
      summary: { processed, success, errors, skipped, duplicates, byEntity },
    });

  } catch (err: unknown) {
    console.error('Execute error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
