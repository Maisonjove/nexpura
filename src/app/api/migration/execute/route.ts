import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
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

export const maxDuration = 300;

// Per-chunk row budget. Chunks aim to comfortably finish under
// Vercel's 300s lambda cap. A fresh lambda is dispatched via
// Next.js after() to continue the next slice — see chunk dispatch
// below.
const CHUNK_SIZE = 1000;

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

interface MigrationJobRow {
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
const MAX_PARSE_BYTES = 20 * 1024 * 1024;

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
interface ChunkAccumulators {
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
async function processChunkOfRows(
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

    acc.processed++;
    rowsProcessed++;
    if (result.status === 'success') { acc.success++; acc.byEntity[entity].success++; }
    else if (result.status === 'duplicate') { acc.duplicates++; acc.byEntity[entity].duplicate++; acc.success++; }
    else if (result.status === 'error') { acc.errors++; acc.byEntity[entity].error++; }
    else if (result.status === 'skipped') { acc.skipped++; acc.byEntity[entity].skipped++; }

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
      job_id: jobId,
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
      await admin.from('migration_jobs').update({
        processed_records: acc.processed,
        success_count: acc.success,
        error_count: acc.errors,
        skipped_count: acc.skipped,
      }).eq('id', jobId);
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
// Invoked by /api/migration/execute on itself via Next.js after()
// after the first call (and after each subsequent chunk) returns.
// Auth is via the per-job `internal_token` — first-call generated
// this and persisted it on migration_jobs; chunk-continue calls
// must echo it back. Skip user auth/role/rate-limit (those ran on
// first-call only) but still go through middleware (CSRF needs
// Origin/Referer, which the dispatcher sets).
async function handleChunkContinue(
  req: NextRequest,
  body: { jobId?: unknown; internalToken?: unknown; _continueChunk?: unknown },
): Promise<NextResponse> {
  const admin = createAdminClient();

  const jobId = typeof body.jobId === 'string' ? body.jobId : null;
  const internalToken = typeof body.internalToken === 'string' ? body.internalToken : null;
  if (!jobId || !internalToken) {
    return NextResponse.json({ error: 'Missing jobId or internalToken' }, { status: 400 });
  }

  const { data: jobRow } = await admin
    .from('migration_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  const job = jobRow as MigrationJobRow | null;
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (!job.internal_token || job.internal_token !== internalToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // If the job was cancelled (job-status route POST?action=cancel
  // sets status=failed) or already completed, stop dispatching.
  if (job.status !== 'running') {
    logger.info('[migration-execute] chunk skipped (job not running)', { jobId, status: job.status });
    return NextResponse.json({ ok: true, done: true });
  }

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
    await admin.from('migration_jobs').update({
      status: 'failed',
      error_message: 'Session disappeared mid-import',
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: rawFiles } = await admin
    .from('migration_files')
    .select('*, migration_mappings(*)')
    .eq('session_id', sessionId)
    .in('status', ['classified', 'ready', 'pending', 'imported']);

  const files = (rawFiles ?? []) as MigrationFile[];
  // Sort identically to first-call so current_file_index points at
  // the same file across dispatches. (Note: we include 'imported'
  // here so already-finished files keep their slot in the sorted
  // list — otherwise current_file_index would shift after a file
  // completes.)
  const sortedFiles = [...files].sort((a, b) =>
    entitySortKey(a.detected_entity ?? 'unknown') - entitySortKey(b.detected_entity ?? 'unknown')
  );

  // Past the last file → finalise.
  if (job.current_file_index >= sortedFiles.length) {
    return finaliseJob(admin, job, tenantId, sessionId);
  }

  const currentFile = sortedFiles[job.current_file_index];

  // If this file is already imported, skip ahead to the next file
  // and dispatch — defensive against any state drift.
  if (currentFile && (currentFile as unknown as { status?: string }).status === 'imported') {
    await admin.from('migration_jobs').update({
      current_file_index: job.current_file_index + 1,
      current_row_offset: 0,
    }).eq('id', jobId);
    dispatchNextChunk(req, jobId, internalToken);
    return NextResponse.json({ ok: true, more: true });
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
    await admin.from('migration_jobs').update({
      status: 'failed',
      error_message: e instanceof Error ? e.message : String(e),
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
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

  // Restore running totals from the job row so the chunk continues
  // accumulating, not overwriting.
  const acc: ChunkAccumulators = {
    processed: job.processed_records ?? 0,
    success: job.success_count ?? 0,
    warnings: 0,
    errors: job.error_count ?? 0,
    skipped: job.skipped_count ?? 0,
    duplicates: 0,
    byEntity: (job.results_summary?.by_entity as ChunkAccumulators['byEntity']) ?? {},
  };
  // warnings/duplicates are only used to compute warning_count at
  // finalisation; we backfill from results_summary if present so the
  // counter stays monotonic across chunks.
  if (job.results_summary && typeof job.results_summary.total_duplicates === 'number') {
    acc.duplicates = job.results_summary.total_duplicates;
  }

  // Cross-chunk lookup maps: NOT persisted by design (see route
  // header comment). Each chunk rebuilds an empty Map and falls
  // through to findDuplicateCustomer / DB invoice lookup, which
  // already handles the cross-chunk case via the duplicate-detect
  // path.
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

  // Build updated results_summary so the next chunk can resume
  // byEntity totals.
  const updatedSummary = {
    by_entity: acc.byEntity,
    total_processed: acc.processed,
    total_success: acc.success,
    total_errors: acc.errors,
    total_skipped: acc.skipped,
    total_duplicates: acc.duplicates,
  };

  if (fileFinished) {
    await admin.from('migration_files').update({ status: 'imported' }).eq('id', currentFile.id);
    await admin.from('migration_jobs').update({
      current_file_index: job.current_file_index + 1,
      current_row_offset: 0,
      processed_records: acc.processed,
      success_count: acc.success,
      warning_count: acc.duplicates,
      error_count: acc.errors,
      skipped_count: acc.skipped,
      results_summary: updatedSummary,
    }).eq('id', jobId);

    // More files? dispatch next chunk. Else finalise.
    if (job.current_file_index + 1 < sortedFiles.length) {
      dispatchNextChunk(req, jobId, internalToken);
      return NextResponse.json({ ok: true, more: true });
    }
    // Reload the (just-updated) job so finaliseJob sees the latest
    // counters in results_summary.
    const { data: refreshed } = await admin
      .from('migration_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    return finaliseJob(admin, (refreshed as MigrationJobRow) ?? job, tenantId, sessionId);
  }

  // Mid-file: advance the row cursor, persist counters, dispatch.
  await admin.from('migration_jobs').update({
    current_row_offset: newOffset,
    processed_records: acc.processed,
    success_count: acc.success,
    warning_count: acc.duplicates,
    error_count: acc.errors,
    skipped_count: acc.skipped,
    results_summary: updatedSummary,
  }).eq('id', jobId);

  dispatchNextChunk(req, jobId, internalToken);
  return NextResponse.json({ ok: true, more: true });
}

async function finaliseJob(
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

  await admin.from('migration_jobs').update({
    status: finalStatus,
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  await admin.from('migration_sessions').update({
    status: 'complete',
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId);

  await admin.from('migration_logs').insert({
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

  return NextResponse.json({ ok: true, done: true });
}

// Dispatch the next chunk via Next.js after(). The fetch is
// fire-and-forget — the current lambda returns to the client
// without waiting for the next chunk to start, and the next
// chunk runs in its own fresh lambda with a full 300s budget.
//
// Origin + Referer + Cookie are set so the global CSRF middleware
// (which gates /api/** mutating requests) lets the call through —
// see PR #69 for the same pattern on /api/migration/upload's
// internal classify call.
function dispatchNextChunk(req: NextRequest, jobId: string, internalToken: string): void {
  const origin = req.nextUrl.origin;
  const dispatchHeaders = {
    'Content-Type': 'application/json',
    'Origin': origin,
    'Referer': `${origin}/`,
    'Cookie': req.headers.get('cookie') || '',
  };
  after(async () => {
    try {
      await fetch(`${origin}/api/migration/execute`, {
        method: 'POST',
        headers: dispatchHeaders,
        body: JSON.stringify({ jobId, _continueChunk: true, internalToken }),
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
  });
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  try {
    // Branch on body shape: chunk-continue calls carry
    // `_continueChunk: true` and skip auth/rate-limit (they're
    // gated by the internal_token instead).
    const body = await req.json();
    if (body && body._continueChunk === true) {
      return await handleChunkContinue(req, body);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit migration executions per user AND per tenant. The
    // per-tenant guard closes the audit's TOCTOU race window where two
    // owner/admins on the same tenant could each kick off a concurrent
    // import and the SELECT-then-INSERT dedupe in findDuplicateCustomer
    // could allow two rows for the same email (no DB-level unique
    // constraint exists on (tenant_id, lower(email))).
    const { success: userRateOk } = await checkRateLimit(`migration-execute:user:${user.id}`, 'heavy');
    if (!userRateOk) {
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

    // Per-tenant rate limit (closes the TOCTOU race — see comment above).
    const { success: tenantRateOk } = await checkRateLimit(`migration-execute:tenant:${tenantId}`, 'heavy');
    if (!tenantRateOk) {
      return NextResponse.json({ error: 'Another import is already running for this tenant. Wait for it to finish before starting another.' }, { status: 429 });
    }

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

    // Per-job secret. Chunk-continue calls must echo this back.
    // Stored on the job row only — the client never sees it (the
    // /api/migration/job-status route doesn't have to filter it
    // out for status reads, but if we end up serialising the full
    // row anywhere we should).
    const internalToken = randomUUID();

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
        current_file_index: 0,
        current_row_offset: 0,
        internal_token: internalToken,
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

    // Edge case: session has no files to process. Mark complete
    // immediately so the polling client doesn't spin forever.
    if (sortedFiles.length === 0) {
      await admin.from('migration_jobs').update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        results_summary: { by_entity: {}, total_processed: 0, total_success: 0, total_errors: 0, total_skipped: 0, total_duplicates: 0 },
      }).eq('id', job.id);
      await admin.from('migration_sessions').update({
        status: 'complete',
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);
      return NextResponse.json({ jobId: job.id, success: true });
    }

    // Dispatch the FIRST chunk via after() — fresh lambda, full
    // 300s budget. The client gets { jobId, success: true } back
    // immediately and starts polling /api/migration/job-status.
    dispatchNextChunk(req, job.id, internalToken);

    return NextResponse.json({
      jobId: job.id,
      success: true,
    });
  } catch (err: unknown) {
    logger.error('Execute error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
