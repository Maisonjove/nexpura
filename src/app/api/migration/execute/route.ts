import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  parseCSVFull, parseXLSXFull, applyMappings, buildDefaultMappings,
  importCustomer, importInventory, importRepair, importBespokeJob,
  importSupplier, importInvoice, importPayment,
  findDuplicateCustomer,
  CUSTOMER_DEFAULT_MAPPINGS, INVENTORY_DEFAULT_MAPPINGS,
  REPAIR_DEFAULT_MAPPINGS, BESPOKE_DEFAULT_MAPPINGS,
  SUPPLIER_DEFAULT_MAPPINGS, INVOICE_DEFAULT_MAPPINGS, PAYMENT_DEFAULT_MAPPINGS,
  type ImportContext, type ImportRow, type MappingEntry,
} from '@/lib/migration/engine';
import logger from "@/lib/logger";

export const maxDuration = 300;

type EntityType = 'customers' | 'inventory' | 'repairs' | 'bespoke' | 'suppliers' | 'invoices' | 'payments' | 'unknown';

const ENTITY_ORDER: EntityType[] = ['customers', 'suppliers', 'inventory', 'repairs', 'bespoke', 'invoices', 'payments'];
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
  const storedMappings = file.migration_mappings?.[0]?.mappings;
  if (storedMappings && storedMappings.length > 0) return storedMappings;
  const headers = file.column_headers ?? [];
  const entity = (file.detected_entity ?? 'unknown') as EntityType;
  if (entity === 'customers') return buildDefaultMappings(headers, CUSTOMER_DEFAULT_MAPPINGS);
  if (entity === 'inventory') return buildDefaultMappings(headers, INVENTORY_DEFAULT_MAPPINGS);
  if (entity === 'repairs') return buildDefaultMappings(headers, REPAIR_DEFAULT_MAPPINGS);
  if (entity === 'bespoke') return buildDefaultMappings(headers, BESPOKE_DEFAULT_MAPPINGS);
  if (entity === 'suppliers') return buildDefaultMappings(headers, SUPPLIER_DEFAULT_MAPPINGS);
  if (entity === 'invoices') return buildDefaultMappings(headers, INVOICE_DEFAULT_MAPPINGS);
  if (entity === 'payments') return buildDefaultMappings(headers, PAYMENT_DEFAULT_MAPPINGS);
  return [];
}

/**
 * Resolve a customer reference for repairs / bespoke / invoices import
 * rows. Audit fix: pre-fix when a row carried a customer_email or
 * customer_name that didn't resolve in either the in-session map or
 * findDuplicateCustomer, we silently inserted with customer_id=null —
 * orphaned jobs the jeweller couldn't reconcile post-import.
 *
 * Now: if the row references a customer (email or name set) and the
 * lookup fails, return an explicit error so the row lands in the
 * error count with a clear message. Only allow customer_id=null when
 * the source row has no customer reference at all (truly orphan in
 * the source data).
 */
async function resolveCustomerForJob(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  mappedData: Record<string, unknown>,
  emailToCustomerId: Map<string, string>,
): Promise<{ customerId?: string; error?: string }> {
  const email = String(mappedData.customer_email || '').toLowerCase();
  const name = (mappedData.customer_name as string | undefined) || undefined;
  const referencesCustomer = Boolean(email || name);

  if (!referencesCustomer) return { customerId: undefined };

  if (email && emailToCustomerId.has(email)) {
    return { customerId: emailToCustomerId.get(email) };
  }

  const found = await findDuplicateCustomer(admin, tenantId, {
    email: mappedData.customer_email as string | undefined,
    full_name: name,
  });
  if (found) {
    if (email) emailToCustomerId.set(email, found);
    return { customerId: found };
  }

  return {
    error: `Customer not found in this migration: ${email || name}. Import the customers file before this one, or correct the reference.`,
  };
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit migration executions per user (stricter limit since it's a heavy operation)
    const { success: rateLimitOk } = await checkRateLimit(`migration-execute:${user.id}`);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Migration already in progress. Please wait before starting another.' }, { status: 429 });
    }

    // SECURITY: use admin client — anon client triggers RLS recursion on users
    // table, which can return null and leave tenantId undefined, causing all
    // subsequent inserts to run without a tenant_id.
    const { data: profile } = await admin
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    const tenantId = (profile as { tenant_id: string } | null)?.tenant_id;

    // Hard-fail if tenant cannot be resolved — never proceed with undefined tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 403 });
    }

    // Migration execute does bulk writes across customers / inventory /
    // repairs / invoices etc. Owner/admin only — staff have no reason to
    // trigger a multi-hundred-row import against the tenant.
    const role = (profile as { role?: string } | null)?.role ?? 'staff';
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = (await import('@/lib/schemas')).migrationExecuteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { sessionId } = parseResult.data;

    // SECURITY: enforce tenant ownership on session lookup.
    // Without .eq('tenant_id', tenantId), an authenticated user from Tenant A
    // could supply Tenant B's sessionId and read/execute their migration files.
    const { data: sessionData } = await admin
      .from('migration_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .single();

    const session = sessionData as MigrationSession | null;
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Audit fix: session-level replay guard. The migration_files filter
    // below skips already-imported files (they transition to
    // status='imported'), so a re-execute on a successful session
    // becomes a no-op the user can't distinguish from success. For
    // sessions in 'complete' / 'complete_with_errors', refuse outright
    // so the operator must create a new session — otherwise repairs/
    // bespoke jobs (no unique constraint) could duplicate if a partial
    // file got re-processed via a status edge case.
    const sessionStatus = (session as { status?: string }).status;
    if (sessionStatus === 'complete' || sessionStatus === 'complete_with_errors') {
      return NextResponse.json({
        error: `Migration session already executed (status=${sessionStatus}). Create a new session to re-run.`,
      }, { status: 409 });
    }

    const { data: rawFiles } = await admin
      .from('migration_files')
      .select('*, migration_mappings(*)')
      .eq('session_id', sessionId)
      .in('status', ['classified', 'ready', 'pending']);

    const files = (rawFiles ?? []) as MigrationFile[];
    const sortedFiles = [...files].sort((a, b) =>
      entitySortKey(a.detected_entity ?? 'unknown') - entitySortKey(b.detected_entity ?? 'unknown')
    );
    const totalRecords = sortedFiles.reduce((sum, f) => sum + (f.row_count || 0), 0);

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

    await admin.from('migration_logs').insert({
      tenant_id: tenantId,
      session_id: sessionId,
      job_id: job.id,
      actor_id: user.id,
      action: 'job_started',
      details: { total_records: totalRecords, source_platform: session.source_platform },
    });

    const dataScope = session.data_scope ?? 'active_and_recent';
    let processed = 0, success = 0, warnings = 0, errors = 0, skipped = 0, duplicates = 0;
    const byEntity: Record<string, { success: number; error: number; skipped: number; duplicate: number }> = {};
    const emailToCustomerId = new Map<string, string>();
    const invoiceNumberToId = new Map<string, string>();

    for (const file of sortedFiles) {
      const entity = (file.detected_entity ?? 'unknown') as EntityType;
      if (!byEntity[entity]) byEntity[entity] = { success: 0, error: 0, skipped: 0, duplicate: 0 };
      const mappings = getMappingsForFile(file);
      const rows = await parseFileFromStorage(admin, file);
      const ctx: ImportContext = {
        tenantId: tenantId,
        jobId: job.id,
        sessionId,
        sourcePlatform: session.source_platform,
        sourceFileName: file.original_name,
        importUserId: user.id,
        dataScope,
      };

      const BATCH_SIZE = 50;
      const jobRecords: Array<Record<string, unknown>> = [];

      for (let i = 0; i < rows.length; i++) {
        const sourceRow = rows[i];
        const rowNum = i + 1;

        // applyMappings calls normalizeValue which now THROWS on
        // unparseable numbers / ambiguous dates instead of silently
        // returning null. Catch here so a single bad row becomes a
        // row-level error in the summary instead of killing the whole
        // file's import loop.
        let mappedData: Record<string, unknown>;
        try {
          mappedData = applyMappings(sourceRow, mappings);
        } catch (e) {
          const result = { status: 'error', error: e instanceof Error ? e.message : String(e) };
          processed++;
          errors++;
          byEntity[entity].error++;
          jobRecords.push({
            tenant_id: tenantId,
            session_id: sessionId,
            job_id: job.id,
            file_id: file.id,
            entity_type: entity,
            destination_table: entity,
            source_row_number: rowNum,
            source_external_id: '',
            source_data: sourceRow,
            status: 'error',
            error_message: result.error,
          });
          if (jobRecords.length >= BATCH_SIZE) {
            await admin.from('migration_job_records').insert(jobRecords);
            jobRecords.length = 0;
          }
          continue;
        }

        const importRow: ImportRow = {
          sourceRowNumber: rowNum,
          sourceData: sourceRow,
          sourceExternalId: String(
            mappedData.source_id || mappedData.sku || mappedData.repair_number ||
            mappedData.job_number || mappedData.invoice_number || ''
          ),
        };

        let result: { status: string; recordId?: string; error?: string; invoiceNumber?: string } = { status: 'skipped' };

        if (entity === 'customers') {
          result = await importCustomer(admin, ctx, importRow, mappedData);
          if ((result.status === 'success' || result.status === 'duplicate') && result.recordId) {
            const email = String(mappedData.email || '').toLowerCase();
            if (email) emailToCustomerId.set(email, result.recordId);
          }
        } else if (entity === 'inventory') {
          result = await importInventory(admin, ctx, importRow, mappedData);
        } else if (entity === 'suppliers') {
          result = await importSupplier(admin, ctx, importRow, mappedData);
        } else if (entity === 'repairs') {
          const lookup = await resolveCustomerForJob(admin, tenantId, mappedData, emailToCustomerId);
          if (lookup.error) {
            result = { status: 'error', error: lookup.error };
          } else {
            result = await importRepair(admin, ctx, importRow, mappedData, lookup.customerId);
          }
        } else if (entity === 'bespoke') {
          const lookup = await resolveCustomerForJob(admin, tenantId, mappedData, emailToCustomerId);
          if (lookup.error) {
            result = { status: 'error', error: lookup.error };
          } else {
            result = await importBespokeJob(admin, ctx, importRow, mappedData, lookup.customerId);
          }
        } else if (entity === 'invoices') {
          const lookup = await resolveCustomerForJob(admin, tenantId, mappedData, emailToCustomerId);
          if (lookup.error) {
            result = { status: 'error', error: lookup.error };
          } else {
            result = await importInvoice(admin, ctx, importRow, mappedData, lookup.customerId);
            if ((result.status === 'success' || result.status === 'duplicate') && result.recordId) {
              const invNum = result.invoiceNumber || String(mappedData.invoice_number || '');
              if (invNum) invoiceNumberToId.set(invNum, result.recordId);
            }
          }
        } else if (entity === 'payments') {
          let invoiceId: string | undefined;
          const invNum = String(mappedData.invoice_number || '');
          if (invNum && invoiceNumberToId.has(invNum)) {
            invoiceId = invoiceNumberToId.get(invNum);
          } else if (invNum) {
            const { data: invRow } = await admin
              .from('invoices')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('invoice_number', invNum)
              .maybeSingle();
            if (invRow) {
              invoiceId = (invRow as { id: string }).id;
              invoiceNumberToId.set(invNum, invoiceId);
            }
          }
          result = await importPayment(admin, ctx, importRow, mappedData, invoiceId);
        } else {
          result = { status: 'skipped' };
        }

        processed++;
        if (result.status === 'success') { success++; byEntity[entity].success++; }
        else if (result.status === 'duplicate') { duplicates++; byEntity[entity].duplicate++; success++; }
        else if (result.status === 'error') { errors++; byEntity[entity].error++; }
        else if (result.status === 'skipped') { skipped++; byEntity[entity].skipped++; }

        const destinationTable = entity === 'customers' ? 'customers'
          : entity === 'inventory' ? 'inventory'
          : entity === 'repairs' ? 'repairs'
          : entity === 'bespoke' ? 'bespoke_jobs'
          : entity === 'suppliers' ? 'suppliers'
          : entity === 'invoices' ? 'invoices'
          : entity === 'payments' ? 'payments'
          : null;

        jobRecords.push({
          tenant_id: tenantId,
          job_id: job.id,
          session_id: sessionId,
          source_file_id: file.id,
          entity_type: entity,
          source_row_number: rowNum,
          source_external_id: importRow.sourceExternalId || null,
          destination_record_id: result.recordId || null,
          destination_table: destinationTable,
          status: result.status === 'duplicate' ? 'warning' : result.status,
          error_message: result.error || null,
          warning_message: result.status === 'duplicate' ? `Duplicate — matched existing record ${result.recordId}` : null,
          source_data: { ...sourceRow, _mapped: mappedData },
        });

        if (jobRecords.length >= BATCH_SIZE) {
          await admin.from('migration_job_records').insert(jobRecords.splice(0, BATCH_SIZE));
          await admin.from('migration_jobs').update({
            processed_records: processed,
            success_count: success,
            error_count: errors,
            skipped_count: skipped,
          }).eq('id', job.id);
        }
      }

      if (jobRecords.length > 0) {
        await admin.from('migration_job_records').insert(jobRecords);
      }
      await admin.from('migration_files').update({ status: 'imported' }).eq('id', file.id);
    }

    const finalStatus = errors > 0 && success === 0 ? 'failed'
      : errors > 0 ? 'complete_with_errors'
      : 'complete';

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

    await admin.from('migration_sessions').update({
      status: 'complete',
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId);

    await admin.from('migration_logs').insert({
      tenant_id: tenantId,
      session_id: sessionId,
      job_id: job.id,
      actor_id: user.id,
      action: 'job_complete',
      details: { success_count: success, warning_count: warnings, error_count: errors, skipped_count: skipped, duplicate_count: duplicates, by_entity: byEntity },
    });

    return NextResponse.json({
      jobId: job.id,
      success: true,
      summary: { processed, success, errors, skipped, duplicates, byEntity },
    });
  } catch (err: unknown) {
    logger.error('Execute error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
