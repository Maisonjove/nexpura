import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseCSVFull, parseXLSXFull, applyMappings, buildDefaultMappings,
  importCustomer, importInventory, importRepair, importBespokeJob,
  importSupplier, importInvoice, importPayment,
  findDuplicateCustomer, normaliseMappingEntry,
  CUSTOMER_DEFAULT_MAPPINGS, INVENTORY_DEFAULT_MAPPINGS,
  REPAIR_DEFAULT_MAPPINGS, BESPOKE_DEFAULT_MAPPINGS,
  SUPPLIER_DEFAULT_MAPPINGS, INVOICE_DEFAULT_MAPPINGS, PAYMENT_DEFAULT_MAPPINGS,
  type ImportContext, type ImportRow, type MappingEntry,
} from '@/lib/migration/engine';
import logger from "@/lib/logger";

// Per-chunk row budget. Chunks aim to comfortably finish under
// Vercel's 300s lambda cap. A fresh lambda is dispatched via
// Next.js after() to continue the next slice — see chunk dispatch
// below.
export const CHUNK_SIZE = 1000;

export type EntityType = 'customers' | 'inventory' | 'repairs' | 'bespoke' | 'suppliers' | 'invoices' | 'payments' | 'unknown';

export const ENTITY_ORDER: EntityType[] = ['customers', 'suppliers', 'inventory', 'repairs', 'bespoke', 'invoices', 'payments'];
export function entitySortKey(e: EntityType): number {
  const idx = ENTITY_ORDER.indexOf(e);
  return idx === -1 ? 99 : idx;
}

export interface MigrationFile {
  id: string;
  original_name: string;
  storage_path: string;
  detected_entity: EntityType | null;
  row_count: number | null;
  column_headers: string[] | null;
  migration_mappings?: Array<{ mappings: MappingEntry[] | null }>;
}

export interface MigrationSession {
  id: string;
  source_platform: string;
  data_scope: 'active' | 'active_and_recent' | 'full_archive' | null;
  status: string;
}

export interface MigrationJobRow {
  id: string;
  tenant_id: string;
  session_id: string;
  status: string;
  total_records: number | null;
  processed_records: number | null;
  success_count: number | null;
  warning_count: number | null;
  error_count: number | null;
  skipped_count: number | null;
  current_file_index: number;
  current_row_offset: number;
  internal_token: string | null;
  results_summary: Record<string, unknown> | null;
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

// Audit fix: parseFileFromStorage is called during execute, AFTER
// upload validation. Pre-fix the 20MB cap was only checked in
// /api/migration/upload — a tampered storage object (or a CSV that
// ballooned during a failed previous upload) could load arbitrary
// bytes here and OOM the lambda mid-import (Vercel Pro lambda is
// 1GB; ExcelJS workbook representations can multiply input size 5-10x
// in memory). Match the upload limit here too.
export const MAX_PARSE_BYTES = 20 * 1024 * 1024;

async function parseFileFromStorage(
  admin: ReturnType<typeof createAdminClient>,
  file: MigrationFile
): Promise<Array<Record<string, unknown>>> {
  const bytes = await downloadFile(admin, file.storage_path);
  if (!bytes) return [];
  if (bytes.byteLength > MAX_PARSE_BYTES) {
    logger.error('[migration-execute] file exceeds parse-time size limit', {
      fileId: file.id,
      bytes: bytes.byteLength,
      max: MAX_PARSE_BYTES,
    });
    throw new Error(
      `File too large to parse: ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB exceeds ${MAX_PARSE_BYTES / 1024 / 1024} MB cap. Re-upload a smaller file.`,
    );
  }
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
  if (storedMappings && storedMappings.length > 0) {
    // The classify endpoint persists mappings with snake_case keys
    // (source_col / destination_field), but the engine's MappingEntry
    // is camelCase. normaliseMappingEntry handles either casing so
    // post-classify mappings don't throw on
    // m.sourceColumn.toLowerCase() in applyMappings.
    return storedMappings
      .map((m) => normaliseMappingEntry(m))
      .filter((m): m is MappingEntry => m !== null);
  }
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

// ============================================================
// Chunked-execution helper
// ============================================================
//
// Mutable accumulators threaded through the row loop. The chunk
// loop updates these and the caller flushes them to migration_jobs
// at chunk-end so a polling client sees progress between dispatches.
export interface ChunkAccumulators {
  processed: number;
  success: number;
  warnings: number;
  errors: number;
  skipped: number;
  duplicates: number;
  byEntity: Record<string, { success: number; error: number; skipped: number; duplicate: number }>;
}

/**
 * Process a slice of rows from a single file. Caller passes
 * `fromOffset` and a `chunkSize` cap; the helper returns how many
 * rows it actually consumed (always <= rows.length - fromOffset).
 *
 * Per-row behaviour mirrors the original synchronous loop exactly
 * — applyMappings try/catch, importCustomer/Inventory/etc.,
 * resolveCustomerForJob, migration_job_records batch-insert with
 * try/catch from PR #64 — only the iteration bounds change.
 */
export async function processChunkOfRows(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ImportContext,
  file: MigrationFile,
  rows: Array<Record<string, unknown>>,
  mappings: MappingEntry[],
  fromOffset: number,
  chunkSize: number,
  acc: ChunkAccumulators,
  emailToCustomerId: Map<string, string>,
  invoiceNumberToId: Map<string, string>,
): Promise<{ rowsProcessed: number }> {
  const tenantId = ctx.tenantId;
  const sessionId = ctx.sessionId;
  const jobId = ctx.jobId;
  const entity = (file.detected_entity ?? 'unknown') as EntityType;
  if (!acc.byEntity[entity]) acc.byEntity[entity] = { success: 0, error: 0, skipped: 0, duplicate: 0 };

  const BATCH_SIZE = 50;
  const jobRecords: Array<Record<string, unknown>> = [];

  const end = Math.min(rows.length, fromOffset + chunkSize);
  let rowsProcessed = 0;

  for (let i = fromOffset; i < end; i++) {
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
      acc.processed++;
      acc.errors++;
      acc.byEntity[entity].error++;
      rowsProcessed++;
      jobRecords.push({
        tenant_id: tenantId,
        session_id: sessionId,
        job_id: jobId,
        // Schema column is source_file_id, not file_id. Pre-fix
        // every batch that contained even one parse-error row was
        // rejected by Postgres ("column file_id does not exist"),
        // wiping the audit log for the entire 50-row chunk.
        source_file_id: file.id,
        entity_type: entity,
        destination_table: entity,
        source_row_number: rowNum,
        source_external_id: '',
        source_data: sourceRow,
        status: 'error',
        error_message: result.error,
      });
      if (jobRecords.length >= BATCH_SIZE) {
        const batch = jobRecords.splice(0, BATCH_SIZE);
        const { error: jobRecordsErr } = await admin.from('migration_job_records').insert(batch);
        if (jobRecordsErr) {
          logger.error('[migration-execute] audit-log batch insert failed', {
            jobId,
            fileId: file.id,
            batchSize: batch.length,
            error: jobRecordsErr.message,
          });
        }
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

    let result: { status: string; recordId?: string; error?: string; invoiceNumber?: string; warnings?: string[] } = { status: 'skipped' };

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

    acc.processed++;
    rowsProcessed++;
    if (result.status === 'success') { acc.success++; acc.byEntity[entity].success++; }
    else if (result.status === 'duplicate') { acc.duplicates++; acc.byEntity[entity].duplicate++; acc.success++; }
    else if (result.status === 'error') { acc.errors++; acc.byEntity[entity].error++; }
    else if (result.status === 'skipped') { acc.skipped++; acc.byEntity[entity].skipped++; }

    // Per-row warnings (e.g. blank required field accepted as NULL):
    // increment the job-level warning counter so migration_jobs reflects
    // reality even when a row is otherwise a clean success. Pre-fix the
    // counter only ticked for duplicates, so silent substitutions
    // (Group 13 audit finding) hid in success_count.
    if (result.warnings && result.warnings.length > 0) {
      acc.warnings++;
    }

    const destinationTable = entity === 'customers' ? 'customers'
      : entity === 'inventory' ? 'inventory'
      : entity === 'repairs' ? 'repairs'
      : entity === 'bespoke' ? 'bespoke_jobs'
      : entity === 'suppliers' ? 'suppliers'
      : entity === 'invoices' ? 'invoices'
      : entity === 'payments' ? 'payments'
      : null;

    // Compose warning_message from result.warnings (data-integrity flags
    // from the importer) or the duplicate fallback. Status is downgraded
    // to 'warning' if EITHER condition fires — pre-fix only duplicates
    // ever flipped the status, so silent substitutions (e.g. blank
    // full_name → NULL) appeared as clean 'success' rows.
    const isDuplicate = result.status === 'duplicate';
    const hasWarnings = (result.warnings?.length ?? 0) > 0;
    const warningParts: string[] = [];
    if (isDuplicate) warningParts.push(`Duplicate — matched existing record ${result.recordId}`);
    if (hasWarnings) warningParts.push(...(result.warnings as string[]));
    jobRecords.push({
      tenant_id: tenantId,
      job_id: jobId,
      session_id: sessionId,
      source_file_id: file.id,
      entity_type: entity,
      source_row_number: rowNum,
      source_external_id: importRow.sourceExternalId || null,
      destination_record_id: result.recordId || null,
      destination_table: destinationTable,
      status: (isDuplicate || hasWarnings) ? 'warning' : result.status,
      error_message: result.error || null,
      warning_message: warningParts.length ? warningParts.join('; ') : null,
      source_data: { ...sourceRow, _mapped: mappedData },
    });

    if (jobRecords.length >= BATCH_SIZE) {
      // Audit fix: pre-fix a failure of the audit-log batch insert
      // (e.g. a single row violating a constraint, payload-too-large)
      // would crash the entire row loop unhandled, leaving the
      // migration_jobs counter stale and the file in mid-import
      // state. Now: catch + log + continue. The actual customer/
      // inventory/etc rows are already inserted at this point —
      // this is bookkeeping, so degraded audit log > aborted import.
      const batch = jobRecords.splice(0, BATCH_SIZE);
      const { error: jobRecordsErr } = await admin.from('migration_job_records').insert(batch);
      if (jobRecordsErr) {
        logger.error('[migration-execute] audit-log batch insert failed', {
          jobId,
          fileId: file.id,
          batchSize: batch.length,
          error: jobRecordsErr.message,
        });
      }
      // Destructive (job progress) but log + continue — chunk-runner
      // is a cron-fired worker; throwing here aborts the in-flight
      // import. Log loudly so the operator can spot drift; the next
      // chunk batch updates the same fields anyway.
      const { error: progressErr } = await admin
        .from('migration_jobs')
        .update({
          processed_records: acc.processed,
          success_count: acc.success,
          error_count: acc.errors,
          skipped_count: acc.skipped,
        })
        .eq('id', jobId);
      if (progressErr) {
        logger.error('[migration-execute] migration_jobs progress update failed', { jobId, err: progressErr });
      }
    }
  }

  if (jobRecords.length > 0) {
    const { error: tailErr } = await admin.from('migration_job_records').insert(jobRecords);
    if (tailErr) {
      logger.error('[migration-execute] audit-log tail insert failed', {
        jobId,
        fileId: file.id,
        tailSize: jobRecords.length,
        error: tailErr.message,
      });
    }
  }

  return { rowsProcessed };
}

// ============================================================
// Chunk-continue handler
// ============================================================
//
// Invoked by /api/migration/execute-chunk on itself via Next.js after()
// after the first call (and after each subsequent chunk) returns.
// Auth is via the per-job `internal_token` — first-call generated
// this and persisted it on migration_jobs; chunk-continue calls
// must echo it back. This endpoint is exempted from the supabase
// middleware AAL2 gate (cookies rotate during multi-minute imports
// so forwarded session auth is unreliable lambda-to-lambda) but
// still passes through the global CSRF middleware (Origin/Referer
// is set by the dispatcher).
export async function runChunkContinue(
  req: NextRequest,
  body: { jobId?: unknown; internalToken?: unknown },
): Promise<NextResponse> {
  const admin = createAdminClient();

  const jobId = typeof body.jobId === 'string' ? body.jobId : null;
  const internalToken = typeof body.internalToken === 'string' ? body.internalToken : null;
  if (!jobId || !internalToken) {
    return NextResponse.json({ error: 'Missing jobId or internalToken' }, { status: 400 });
  }

  // Quick token check before scheduling the heavy work in after().
  const { data: jobRow } = await admin
    .from('migration_jobs')
    .select('id, internal_token, status')
    .eq('id', jobId)
    .single();
  const jobShallow = jobRow as { id: string; internal_token: string | null; status: string } | null;
  if (!jobShallow) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (!jobShallow.internal_token || jobShallow.internal_token !== internalToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (jobShallow.status !== 'running') {
    logger.info('[migration-execute] chunk skipped (job not running)', { jobId, status: jobShallow.status });
    return NextResponse.json({ ok: true, done: true });
  }

  // Run the chunk SYNCHRONOUSLY (in the request lifecycle, not in
  // after()). Two prior attempts:
  //   • #71  the whole chain inside the FIRST lambda's call tree —
  //          stalled at ~chunk 4 because each chunk's await fetch
  //          accumulated waiting for downstream chunks to respond,
  //          all bounded by the original lambda's 300s budget.
  //   • #72  scheduled work in after(), returned {accepted} fast.
  //          Stalled at chunk 1 → 2 — the after() block apparently
  //          isn't reliable for outbound fetches on Vercel; chunk 2
  //          never started even though chunk 1's work completed.
  //
  // This version: do the work synchronously (each lambda has full
  // 300s for its own ~3min chunk), then dispatch the next chunk
  // via fire-and-forget fetch with `keepalive: true` so Node sends
  // the request even if the lambda terminates immediately after.
  // No after() involved.
  try {
    await runChunk(req, admin, jobId, internalToken);
  } catch (e) {
    logger.error('[migration-execute] chunk runner threw', {
      jobId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    // Don't auto-mark the job failed here — leave it in 'running'
    // so a deferred stale-job sweeper or manual retry can resume.
    return NextResponse.json({ ok: false, error: 'Chunk runner threw' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * The actual chunk processor. Runs inside after() so it has the
 * full 300s of THIS lambda's budget, independent of the dispatching
 * parent's budget.
 */
async function runChunk(
  req: NextRequest,
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  internalToken: string,
): Promise<void> {
  const { data: jobRow } = await admin
    .from('migration_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  const job = jobRow as MigrationJobRow | null;
  if (!job) {
    logger.error('[migration-execute] runChunk: job vanished', { jobId });
    return;
  }
  if (job.status !== 'running') return;

  const tenantId = job.tenant_id;
  const sessionId = job.session_id;

  const { data: sessionData } = await admin
    .from('migration_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .single();
  const session = sessionData as MigrationSession | null;
  if (!session) {
    // Destructive (terminal status flip) — log+continue policy for
    // the chunk-runner; cron will pick up the next tick if this
    // status update fails (job won't progress because session is
    // gone, so eventual cleanup is fine).
    const { error: failErr } = await admin
      .from('migration_jobs')
      .update({
        status: 'failed',
        error_message: 'Session disappeared mid-import',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (failErr) {
      logger.error('[migration-execute] migration_jobs failed-status update failed', { jobId, err: failErr });
    }
    return;
  }

  const { data: rawFiles } = await admin
    .from('migration_files')
    .select('*, migration_mappings(*)')
    .eq('session_id', sessionId)
    .in('status', ['classified', 'ready', 'pending', 'imported']);
  const files = (rawFiles ?? []) as MigrationFile[];
  const sortedFiles = [...files].sort((a, b) =>
    entitySortKey(a.detected_entity ?? 'unknown') - entitySortKey(b.detected_entity ?? 'unknown')
  );

  if (job.current_file_index >= sortedFiles.length) {
    await finaliseJob(admin, job, tenantId, sessionId);
    return;
  }

  const currentFile = sortedFiles[job.current_file_index];
  if (currentFile && (currentFile as unknown as { status?: string }).status === 'imported') {
    // Destructive (file-index advance) — log+continue; if this fails
    // the next cron tick will hit the same condition and try again.
    const { error: skipErr } = await admin
      .from('migration_jobs')
      .update({
        current_file_index: job.current_file_index + 1,
        current_row_offset: 0,
        chunk_claim_until: null,
      })
      .eq('id', jobId);
    if (skipErr) {
      logger.error('[migration-execute] file-skip migration_jobs update failed', { jobId, err: skipErr });
    }
    return;
  }

  let rows: Array<Record<string, unknown>>;
  try {
    rows = await parseFileFromStorage(admin, currentFile);
  } catch (e) {
    logger.error('[migration-execute] parseFileFromStorage failed in chunk', {
      jobId,
      fileId: currentFile.id,
      error: e instanceof Error ? e.message : String(e),
    });
    // Destructive (terminal-failure status) — same chunk-runner
    // policy: log on error; cron retry handles the case.
    const { error: parseFailErr } = await admin
      .from('migration_jobs')
      .update({
        status: 'failed',
        error_message: e instanceof Error ? e.message : String(e),
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (parseFailErr) {
      logger.error('[migration-execute] migration_jobs parse-failed-status update failed', { jobId, err: parseFailErr });
    }
    return;
  }

  const mappings = getMappingsForFile(currentFile);
  const ctx: ImportContext = {
    tenantId,
    jobId,
    sessionId,
    sourcePlatform: session.source_platform,
    sourceFileName: currentFile.original_name,
    importUserId: '',
    dataScope: session.data_scope ?? 'active_and_recent',
  };

  const acc: ChunkAccumulators = {
    processed: job.processed_records ?? 0,
    success: job.success_count ?? 0,
    warnings: 0,
    errors: job.error_count ?? 0,
    skipped: job.skipped_count ?? 0,
    duplicates: 0,
    byEntity: (job.results_summary?.by_entity as ChunkAccumulators['byEntity']) ?? {},
  };
  if (job.results_summary && typeof job.results_summary.total_duplicates === 'number') {
    acc.duplicates = job.results_summary.total_duplicates;
  }

  const emailToCustomerId = new Map<string, string>();
  const invoiceNumberToId = new Map<string, string>();

  const fromOffset = job.current_row_offset;
  const { rowsProcessed } = await processChunkOfRows(
    admin, ctx, currentFile, rows, mappings,
    fromOffset, CHUNK_SIZE,
    acc, emailToCustomerId, invoiceNumberToId,
  );

  const newOffset = fromOffset + rowsProcessed;
  const fileFinished = newOffset >= rows.length;
  const updatedSummary = {
    by_entity: acc.byEntity,
    total_processed: acc.processed,
    total_success: acc.success,
    total_errors: acc.errors,
    total_skipped: acc.skipped,
    total_duplicates: acc.duplicates,
    total_warnings: acc.warnings,
  };

  if (fileFinished) {
    // Destructive (file-status flip + job progress). Log+continue
    // policy. If migration_files update fails, the file stays
    // un-marked-imported, and the next cron tick will reprocess
    // (idempotent via row-offset bookkeeping).
    const { error: fileMarkErr } = await admin
      .from('migration_files')
      .update({ status: 'imported' })
      .eq('id', currentFile.id);
    if (fileMarkErr) {
      logger.error('[migration-execute] migration_files mark-imported failed', { jobId, fileId: currentFile.id, err: fileMarkErr });
    }
    const { error: jobAdvanceErr } = await admin
      .from('migration_jobs')
      .update({
        current_file_index: job.current_file_index + 1,
        current_row_offset: 0,
        processed_records: acc.processed,
        success_count: acc.success,
        // warning_count counts BOTH duplicates AND row-level warnings
        // (e.g. blank required field accepted as NULL). Pre-fix only
        // duplicates ticked the counter, so silent substitutions hid
        // in success_count.
        warning_count: acc.duplicates + acc.warnings,
        error_count: acc.errors,
        skipped_count: acc.skipped,
        results_summary: updatedSummary,
        // Clear the long-held cron claim — see same comment below.
        chunk_claim_until: null,
      })
      .eq('id', jobId);
    if (jobAdvanceErr) {
      logger.error('[migration-execute] migration_jobs file-finish update failed', { jobId, err: jobAdvanceErr });
    }

    if (job.current_file_index + 1 < sortedFiles.length) {
      // dispatchNextChunk removed: the cron is the sole chunk driver.
    // After updated_at goes stale (>30s) the next cron tick claims
    // and runs the next chunk via FOR UPDATE SKIP LOCKED RPC.
      return;
    }
    const { data: refreshed } = await admin
      .from('migration_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    await finaliseJob(admin, (refreshed as MigrationJobRow) ?? job, tenantId, sessionId);
    return;
  }

  // Destructive (chunk progress tick). Log+continue; cron retry will
  // re-attempt from the same offset on next tick.
  const { error: chunkProgressErr } = await admin
    .from('migration_jobs')
    .update({
      current_row_offset: newOffset,
      processed_records: acc.processed,
      success_count: acc.success,
      warning_count: acc.duplicates,
      error_count: acc.errors,
      skipped_count: acc.skipped,
      results_summary: updatedSummary,
      // Clear the long-held cron claim so the next cron tick can
      // immediately pick up this job (instead of waiting up to 5min
      // for chunk_claim_until to expire).
      chunk_claim_until: null,
    })
    .eq('id', jobId);
  if (chunkProgressErr) {
    logger.error('[migration-execute] migration_jobs chunk-progress update failed', { jobId, err: chunkProgressErr });
  }
}

export async function finaliseJob(
  admin: ReturnType<typeof createAdminClient>,
  job: MigrationJobRow,
  tenantId: string,
  sessionId: string,
): Promise<NextResponse> {
  const success = job.success_count ?? 0;
  const errors = job.error_count ?? 0;
  const skipped = job.skipped_count ?? 0;
  const warnings = job.warning_count ?? 0;
  const summary = (job.results_summary ?? {}) as Record<string, unknown>;
  const duplicates = typeof summary.total_duplicates === 'number' ? summary.total_duplicates : 0;

  const finalStatus = errors > 0 && success === 0 ? 'failed'
    : errors > 0 ? 'complete_with_errors'
    : 'complete';

  // Destructive (terminal status flip). Log+continue per chunk-runner
  // policy; cron will not re-pick the job because finaliseJob is the
  // last call before we ack — but if the status update fails, the
  // job will appear "running" until the stale-job sweeper catches it.
  const { error: finalStatusErr } = await admin
    .from('migration_jobs')
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  if (finalStatusErr) {
    logger.error('[migration-execute] migration_jobs finalise-status update failed', { jobId: job.id, err: finalStatusErr });
  }

  // Destructive (session lifecycle). Same policy.
  const { error: sessionStatusErr } = await admin
    .from('migration_sessions')
    .update({
      status: 'complete',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (sessionStatusErr) {
    logger.error('[migration-execute] migration_sessions complete-status update failed', { sessionId, err: sessionStatusErr });
  }

  // Side-effect — migration_logs is the per-job audit trail. Log
  // failures rather than throw; the operator can reconstruct from
  // job/session state if the log row is lost.
  const { error: logInsErr } = await admin.from('migration_logs').insert({
    tenant_id: tenantId,
    session_id: sessionId,
    job_id: job.id,
    action: 'job_complete',
    details: {
      success_count: success,
      warning_count: warnings,
      error_count: errors,
      skipped_count: skipped,
      duplicate_count: duplicates,
      by_entity: summary.by_entity ?? {},
    },
  });
  if (logInsErr) {
    logger.error('[migration-execute] migration_logs job_complete insert failed', { jobId: job.id, err: logInsErr });
  }

  return NextResponse.json({ ok: true, done: true });
}

// Dispatch the next chunk via fetch. Called from inside runChunk
// (which is itself inside after()), so we don't need a NESTED
// after() — the fetch awaits chunk N+1's quick { accepted: true }
// response, then runChunk completes and the lambda terminates
// cleanly. Chunk N+1's actual processing happens in its own after()
// with its own 300s budget.
//
// Origin + Referer are set so the global CSRF middleware (which
// gates /api/** mutating requests) lets the call through — see
// PR #69 for the same pattern on /api/migration/upload's internal
// classify call. NO cookie is forwarded: the target endpoint
// /api/migration/execute-chunk is exempted from supabase middleware
// auth and gates itself solely by the per-job internal_token.
// Forwarding session cookies was actively harmful here because they
// rotate during multi-minute imports and the middleware would 401
// the chain mid-way through.
export function dispatchNextChunk(req: NextRequest, jobId: string, internalToken: string): void {
  const origin = req.nextUrl.origin;
  const dispatchHeaders = {
    'Content-Type': 'application/json',
    'Origin': origin,
    'Referer': `${origin}/`,
  };
  // Fire-and-forget. `keepalive: true` is the magic ingredient —
  // tells Node to allow the request to outlive the originating
  // lambda's request scope so the connection actually completes.
  // We do NOT await — the dispatcher's lambda is free to return
  // its response and terminate immediately; the next chunk's
  // fresh lambda starts independently with its own clean 300s
  // budget. Errors are still logged via .catch() but not retried.
  try {
    fetch(`${origin}/api/migration/execute-chunk`, {
      method: 'POST',
      headers: dispatchHeaders,
      body: JSON.stringify({ jobId, internalToken }),
      keepalive: true,
    }).catch((e) => {
      logger.error('[migration-execute] dispatch fetch failed', {
        jobId,
        error: e instanceof Error ? e.message : String(e),
      });
    });
  } catch (e) {
    // MVP: if the fetch dispatch itself throws (network
    // hiccup, lambda cold start refusal, etc) we do NOT
    // auto-retry. The job row's cursor is unchanged so a
    // manual retry — or a stale-job sweeper — could resume
    // from where we left off. Stale-job recovery is a
    // deferred operational concern.
    logger.error('[migration-execute] failed to dispatch next chunk', {
      jobId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
