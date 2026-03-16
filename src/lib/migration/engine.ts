import { createAdminClient } from '@/lib/supabase/admin';

export interface ImportRow {
  sourceRowNumber: number;
  sourceData: Record<string, unknown>;
  sourceExternalId?: string;
}

export interface MappingEntry {
  sourceColumn: string;
  destinationField: string;
  transformation?: string;
}

export interface MappingConfig {
  mappings: MappingEntry[];
}

export interface ImportContext {
  tenantId: string;
  jobId: string;
  sessionId: string;
  sourcePlatform: string;
  sourceFileName: string;
  importUserId: string;
  dataScope: 'active' | 'active_and_recent' | 'full_archive';
}

export type ImportStatus = 'success' | 'duplicate' | 'error' | 'skipped';

export interface ImportResult {
  status: ImportStatus;
  recordId?: string;
  error?: string;
}

// ─── Default mappings per entity ──────────────────────────────────────────────

interface PatternMap {
  sourcePatterns: string[];
  dest: string;
}

export const CUSTOMER_DEFAULT_MAPPINGS: PatternMap[] = [
  { sourcePatterns: ['customer name', 'full name', 'name', 'client', 'client name'], dest: 'full_name' },
  { sourcePatterns: ['email', 'email address', 'e-mail'], dest: 'email' },
  { sourcePatterns: ['mobile', 'phone', 'phone no', 'phone no.', 'cell', 'telephone', 'contact number', 'mob'], dest: 'mobile' },
  { sourcePatterns: ['ring size', 'ring sz', 'finger size', 'ring sz.'], dest: 'ring_size' },
  { sourcePatterns: ['birthday', 'dob', 'date of birth', 'birth date'], dest: 'birthday' },
  { sourcePatterns: ['anniversary', 'anniv', 'anniv date', 'wedding date'], dest: 'anniversary' },
  { sourcePatterns: ['notes', 'note', 'comments', 'memo'], dest: 'notes' },
  { sourcePatterns: ['store credit', 'credit', 'bal', 'balance', 'account balance'], dest: 'store_credit' },
  { sourcePatterns: ['customer id', 'id', 'client id', 'ref', 'reference'], dest: 'source_id' },
];

export const INVENTORY_DEFAULT_MAPPINGS: PatternMap[] = [
  { sourcePatterns: ['sku', 'item code', 'stock code', 'product code', 'style no', 'item no', 'variant sku'], dest: 'sku' },
  { sourcePatterns: ['name', 'item name', 'product name', 'title', 'description', 'item description'], dest: 'name' },
  { sourcePatterns: ['category', 'type', 'product type', 'item type', 'jewellery type', 'classification'], dest: 'jewellery_type' },
  { sourcePatterns: ['metal', 'metal type', 'material'], dest: 'metal_type' },
  { sourcePatterns: ['metal colour', 'metal color', 'colour', 'color'], dest: 'metal_colour' },
  { sourcePatterns: ['purity', 'karat', 'metal purity', 'hallmark'], dest: 'metal_purity' },
  { sourcePatterns: ['stone', 'stone type', 'gem', 'gemstone', 'centre stone'], dest: 'stone_type' },
  { sourcePatterns: ['stone carat', 'stone weight', 'diamond weight', 'ctw'], dest: 'stone_carat' },
  { sourcePatterns: ['retail price', 'price', 'rrp', 'sell price', 'selling price', 'retail', 'variant price'], dest: 'retail_price' },
  { sourcePatterns: ['cost', 'cost price', 'unit cost', 'buy price', 'landed cost'], dest: 'cost_price' },
  { sourcePatterns: ['qty', 'quantity', 'stock', 'qoh', 'qty on hand', 'quantity on hand', 'in stock', 'variant inventory qty'], dest: 'quantity' },
  { sourcePatterns: ['barcode', 'ean', 'upc', 'gtin'], dest: 'barcode' },
  { sourcePatterns: ['supplier', 'vendor', 'brand', 'manufacturer', 'designer'], dest: 'supplier_name' },
  { sourcePatterns: ['cert', 'cert no', 'certificate', 'cert number', 'gia no', 'gia number', 'grading cert'], dest: 'certificate_number' },
  { sourcePatterns: ['status', 'item status', 'available'], dest: 'status' },
];

export const REPAIR_DEFAULT_MAPPINGS: PatternMap[] = [
  { sourcePatterns: ['repair id', 'job id', 'id', 'ticket', 'ticket no', 'ticket number', 'repair number', 'job number'], dest: 'repair_number' },
  { sourcePatterns: ['customer', 'customer name', 'client', 'client name'], dest: 'customer_name' },
  { sourcePatterns: ['email', 'customer email', 'client email'], dest: 'customer_email' },
  { sourcePatterns: ['item', 'item type', 'jewellery type', 'item description', 'description'], dest: 'item_description' },
  { sourcePatterns: ['repair type', 'service', 'work type', 'job type'], dest: 'repair_type' },
  { sourcePatterns: ['stage', 'status', 'repair status', 'job status'], dest: 'stage' },
  { sourcePatterns: ['quoted price', 'quote', 'price', 'cost', 'amount'], dest: 'quoted_price' },
  { sourcePatterns: ['deposit', 'deposit paid', 'deposit amount', 'prepayment'], dest: 'deposit' },
  { sourcePatterns: ['due date', 'due', 'completion date', 'ready date', 'promised date'], dest: 'due_date' },
  { sourcePatterns: ['notes', 'note', 'instructions', 'work instructions', 'workshop notes'], dest: 'notes' },
];

/** Normalize a column header for fuzzy matching */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/** Build a mapping config from default patterns for a given set of source headers */
export function buildDefaultMappings(headers: string[], patterns: PatternMap[]): MappingEntry[] {
  const result: MappingEntry[] = [];
  const usedDests = new Set<string>();

  for (const header of headers) {
    const norm = normalizeHeader(header);
    for (const pat of patterns) {
      if (usedDests.has(pat.dest)) continue;
      if (pat.sourcePatterns.some(p => normalizeHeader(p) === norm || norm.includes(normalizeHeader(p)))) {
        result.push({ sourceColumn: header, destinationField: pat.dest });
        usedDests.add(pat.dest);
        break;
      }
    }
  }
  return result;
}

// ─── Value normalisation ──────────────────────────────────────────────────────

function normalizeValue(val: unknown, field: string, _transformation?: string): unknown {
  if (val === null || val === undefined) return null;
  const strVal = String(val).trim();
  if (strVal === '') return null;

  const numericFields = ['retail_price', 'cost_price', 'quoted_price', 'deposit_amount', 'amount_paid', 'store_credit', 'quantity', 'stone_carat'];
  if (numericFields.includes(field)) {
    const num = parseFloat(strVal.replace(/[$,\s]/g, ''));
    return isNaN(num) ? null : num;
  }

  const boolFields = ['deposit_paid', 'is_active', 'published'];
  if (boolFields.includes(field)) {
    return ['true', 'yes', '1', 'y'].includes(strVal.toLowerCase());
  }

  const dateFields = ['due_date', 'birthday', 'anniversary', 'invoice_date', 'created_at'];
  if (dateFields.includes(field)) {
    if (!strVal) return null;
    const d = new Date(strVal);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    // Try DD/MM/YYYY
    const parts = strVal.split(/[/\-.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (parseInt(a) <= 31 && parseInt(b) <= 12) {
        const d2 = new Date(`${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`);
        if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
      }
    }
    return null;
  }

  if (field === 'ring_size') return strVal.toUpperCase().replace(/\s/g, '');
  if (field === 'phone' || field === 'mobile') return strVal.replace(/[\s\-()]/g, '');

  return strVal;
}

// ─── Apply column mappings ────────────────────────────────────────────────────

export function applyMappings(
  sourceRow: Record<string, unknown>,
  mappings: MappingEntry[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const m of mappings) {
    const rawVal = sourceRow[m.sourceColumn] ?? sourceRow[m.sourceColumn.toLowerCase()] ?? null;
    if (rawVal === null || rawVal === undefined || rawVal === '') continue;
    result[m.destinationField] = normalizeValue(rawVal, m.destinationField, m.transformation);
  }
  return result;
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

export async function findDuplicateCustomer(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  data: { email?: string; phone?: string; full_name?: string }
): Promise<string | null> {
  if (data.email) {
    const { data: existing } = await admin
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', data.email)
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;
  }
  if (data.phone) {
    const { data: existing } = await admin
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('mobile', data.phone)
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;
  }
  return null;
}

export async function findDuplicateInventory(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  data: { sku?: string; barcode?: string }
): Promise<string | null> {
  if (data.sku) {
    const { data: existing } = await admin
      .from('inventory')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('sku', data.sku)
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;
  }
  if (data.barcode) {
    const { data: existing } = await admin
      .from('inventory')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('barcode', data.barcode)
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;
  }
  return null;
}

// ─── Import metadata ──────────────────────────────────────────────────────────

export function buildImportMetadata(
  ctx: ImportContext,
  sourceRowNumber: number,
  sourceExternalId?: string
) {
  return {
    import_job_id: ctx.jobId,
    source_platform: ctx.sourcePlatform,
    source_file_name: ctx.sourceFileName,
    source_row_number: sourceRowNumber,
    source_external_id: sourceExternalId ?? null,
    imported_at: new Date().toISOString(),
    import_user_id: ctx.importUserId,
  };
}

// ─── Entity importers ─────────────────────────────────────────────────────────

export async function importCustomer(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ImportContext,
  row: ImportRow,
  mappedData: Record<string, unknown>
): Promise<ImportResult> {
  try {
    if (!mappedData.full_name && !mappedData.email && !mappedData.mobile) {
      return { status: 'error', error: 'Row missing name, email, and phone — cannot identify customer' };
    }

    const duplicateId = await findDuplicateCustomer(admin, ctx.tenantId, {
      email: mappedData.email as string | undefined,
      phone: (mappedData.mobile || mappedData.phone) as string | undefined,
      full_name: mappedData.full_name as string | undefined,
    });

    if (duplicateId) return { status: 'duplicate', recordId: duplicateId };

    const { data: created, error } = await admin
      .from('customers')
      .insert({
        tenant_id: ctx.tenantId,
        full_name: (mappedData.full_name || mappedData.name || 'Unknown') as string,
        email: (mappedData.email || null) as string | null,
        mobile: ((mappedData.mobile || mappedData.phone) || null) as string | null,
        birthday: (mappedData.birthday || null) as string | null,
        anniversary: (mappedData.anniversary || null) as string | null,
        ring_size: (mappedData.ring_size || null) as string | null,
        store_credit: parseFloat(String(mappedData.store_credit || '0')) || 0,
        notes: (mappedData.notes || null) as string | null,
        import_metadata: buildImportMetadata(ctx, row.sourceRowNumber, row.sourceExternalId),
      })
      .select('id')
      .single();

    if (error) return { status: 'error', error: error.message };
    return { status: 'success', recordId: (created as { id: string }).id };
  } catch (e: unknown) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function importInventory(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ImportContext,
  row: ImportRow,
  mappedData: Record<string, unknown>
): Promise<ImportResult> {
  try {
    if (!mappedData.name && !mappedData.sku) {
      return { status: 'error', error: 'Row missing item name and SKU' };
    }

    // Scope filter: active only imports active items
    if (ctx.dataScope === 'active' && mappedData.status) {
      const status = String(mappedData.status).toLowerCase();
      if (!['active', 'available', 'in_stock', 'true'].includes(status)) {
        return { status: 'skipped' };
      }
    }

    const duplicateId = await findDuplicateInventory(admin, ctx.tenantId, {
      sku: mappedData.sku as string | undefined,
      barcode: mappedData.barcode as string | undefined,
    });
    if (duplicateId) return { status: 'duplicate', recordId: duplicateId };

    const { data: created, error } = await admin
      .from('inventory')
      .insert({
        tenant_id: ctx.tenantId,
        name: ((mappedData.name || mappedData.title || 'Unnamed Item') as string),
        sku: (mappedData.sku || null) as string | null,
        barcode: (mappedData.barcode || null) as string | null,
        item_type: 'finished_piece',
        jewellery_type: (mappedData.jewellery_type || mappedData.category || null) as string | null,
        metal_type: ((mappedData.metal_type || mappedData.metal) || null) as string | null,
        metal_colour: (mappedData.metal_colour || null) as string | null,
        metal_purity: ((mappedData.metal_purity || mappedData.purity) || null) as string | null,
        stone_type: (mappedData.stone_type || null) as string | null,
        stone_carat: mappedData.stone_carat ? parseFloat(String(mappedData.stone_carat)) : null,
        retail_price: parseFloat(String(mappedData.retail_price || mappedData.price || '0')) || 0,
        cost_price: mappedData.cost_price || mappedData.cost ? parseFloat(String(mappedData.cost_price || mappedData.cost)) || null : null,
        quantity: parseInt(String(mappedData.quantity || mappedData.qty || mappedData.stock || '1')) || 1,
        supplier_name: (mappedData.supplier_name || null) as string | null,
        certificate_number: (mappedData.certificate_number || null) as string | null,
        status: 'active',
        import_metadata: buildImportMetadata(ctx, row.sourceRowNumber, row.sourceExternalId),
      })
      .select('id')
      .single();

    if (error) return { status: 'error', error: error.message };
    return { status: 'success', recordId: (created as { id: string }).id };
  } catch (e: unknown) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function importRepair(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ImportContext,
  row: ImportRow,
  mappedData: Record<string, unknown>,
  customerId?: string
): Promise<ImportResult> {
  try {
    if (ctx.dataScope === 'active') {
      const completedStages = ['collected', 'cancelled', 'archived'];
      const stage = String(mappedData.stage || '').toLowerCase();
      if (completedStages.some(s => stage.includes(s))) return { status: 'skipped' };
    }

    if (!mappedData.item_description && !mappedData.item_type) {
      return { status: 'error', error: 'Repair missing item description' };
    }

    const stageMap: Record<string, string> = {
      'intake': 'intake', 'received': 'intake',
      'assess': 'assessed', 'assessed': 'assessed',
      'quoted': 'quoted', 'approved': 'approved',
      'in progress': 'in_progress', 'in_progress': 'in_progress', 'inprogress': 'in_progress',
      'ready': 'ready', 'complete': 'ready',
      'collected': 'collected',
    };
    const rawStage = String(mappedData.stage || 'intake').toLowerCase().trim();
    const stage = stageMap[rawStage] || 'in_progress';

    const { data: created, error } = await admin
      .from('repairs')
      .insert({
        tenant_id: ctx.tenantId,
        customer_id: customerId || null,
        repair_number: (mappedData.repair_number || null) as string | null,
        item_type: ((mappedData.item_type || 'jewellery') as string),
        item_description: ((mappedData.item_description || mappedData.description || 'Imported repair') as string),
        repair_type: ((mappedData.repair_type || 'General repair') as string),
        work_description: ((mappedData.notes || mappedData.work_description) || null) as string | null,
        stage,
        priority: 'normal',
        quoted_price: mappedData.quoted_price ? parseFloat(String(mappedData.quoted_price)) : null,
        deposit_amount: mappedData.deposit ? parseFloat(String(mappedData.deposit)) : null,
        deposit_paid: Boolean(parseFloat(String(mappedData.deposit || '0')) > 0),
        due_date: (mappedData.due_date || null) as string | null,
        import_metadata: buildImportMetadata(ctx, row.sourceRowNumber, row.sourceExternalId),
      })
      .select('id')
      .single();

    if (error) return { status: 'error', error: error.message };
    return { status: 'success', recordId: (created as { id: string }).id };
  } catch (e: unknown) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function importBespokeJob(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ImportContext,
  row: ImportRow,
  mappedData: Record<string, unknown>,
  customerId?: string
): Promise<ImportResult> {
  try {
    if (ctx.dataScope === 'active') {
      const completedStages = ['collected', 'cancelled', 'archived', 'complete'];
      if (completedStages.some(s => String(mappedData.stage || '').toLowerCase().includes(s))) {
        return { status: 'skipped' };
      }
    }

    const { data: created, error } = await admin
      .from('bespoke_jobs')
      .insert({
        tenant_id: ctx.tenantId,
        customer_id: customerId || null,
        title: ((mappedData.title || mappedData.description || 'Imported bespoke job') as string),
        jewellery_type: (mappedData.jewellery_type || null) as string | null,
        metal_type: (mappedData.metal_type || null) as string | null,
        stage: ((mappedData.stage || 'in_progress') as string),
        priority: 'normal',
        quoted_price: mappedData.quoted_price ? parseFloat(String(mappedData.quoted_price)) : null,
        deposit_amount: mappedData.deposit ? parseFloat(String(mappedData.deposit)) : null,
        deposit_paid: Boolean(parseFloat(String(mappedData.deposit || '0')) > 0),
        due_date: (mappedData.due_date || null) as string | null,
        import_metadata: buildImportMetadata(ctx, row.sourceRowNumber, row.sourceExternalId),
      })
      .select('id')
      .single();

    if (error) return { status: 'error', error: error.message };
    return { status: 'success', recordId: (created as { id: string }).id };
  } catch (e: unknown) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── CSV / XLSX parsing ───────────────────────────────────────────────────────

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export function parseCSVFull(text: string): ParsedFile {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], rowCount: 0 };

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows, rowCount: rows.length };
}

export async function parseXLSXFull(buffer: Uint8Array): Promise<ParsedFile> {
  // Dynamic import to avoid bundling issues in edge runtime
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  if (jsonData.length === 0) return { headers: [], rows: [], rowCount: 0 };

  const headers = (jsonData[0] as unknown[]).map(String);
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const vals = jsonData[i] as unknown[];
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows, rowCount: rows.length };
}
