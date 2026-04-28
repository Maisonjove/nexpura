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

export const BESPOKE_DEFAULT_MAPPINGS: PatternMap[] = [
  { sourcePatterns: ['job number', 'job no', 'job id', 'id', 'bespoke id', 'reference'], dest: 'job_number' },
  { sourcePatterns: ['customer name', 'customer', 'client', 'client name', 'full name'], dest: 'customer_name' },
  { sourcePatterns: ['customer email', 'email', 'client email'], dest: 'customer_email' },
  { sourcePatterns: ['title', 'job title', 'description', 'brief', 'order description'], dest: 'title' },
  { sourcePatterns: ['jewellery type', 'type', 'category', 'item type'], dest: 'jewellery_type' },
  { sourcePatterns: ['metal type', 'metal'], dest: 'metal_type' },
  { sourcePatterns: ['metal colour', 'metal color', 'colour', 'color'], dest: 'metal_colour' },
  { sourcePatterns: ['purity', 'metal purity', 'karat'], dest: 'metal_purity' },
  { sourcePatterns: ['stone type', 'stone', 'gem'], dest: 'stone_type' },
  { sourcePatterns: ['stone carat', 'carat', 'ct', 'stone weight'], dest: 'stone_carat' },
  { sourcePatterns: ['ring size', 'size'], dest: 'ring_size' },
  { sourcePatterns: ['stage', 'status', 'job status'], dest: 'stage' },
  { sourcePatterns: ['quoted price', 'quote', 'price', 'estimated price', 'value'], dest: 'quoted_price' },
  { sourcePatterns: ['deposit', 'deposit amount', 'deposit paid'], dest: 'deposit' },
  { sourcePatterns: ['due date', 'completion date', 'ready date', 'promised date'], dest: 'due_date' },
  { sourcePatterns: ['notes', 'note', 'instructions', 'specifications', 'client notes', 'spec'], dest: 'description' },
];

export const SUPPLIER_DEFAULT_MAPPINGS: PatternMap[] = [
  { sourcePatterns: ['supplier name', 'name', 'company', 'business name', 'vendor name'], dest: 'name' },
  { sourcePatterns: ['contact name', 'contact', 'rep', 'contact person', 'account manager'], dest: 'contact_name' },
  { sourcePatterns: ['email', 'email address', 'contact email'], dest: 'email' },
  { sourcePatterns: ['phone', 'mobile', 'telephone', 'contact number'], dest: 'phone' },
  { sourcePatterns: ['website', 'url', 'web', 'site'], dest: 'website' },
  { sourcePatterns: ['address', 'location', 'street address'], dest: 'address' },
  { sourcePatterns: ['notes', 'note', 'comments', 'description'], dest: 'notes' },
  { sourcePatterns: ['supplier id', 'id', 'vendor id', 'code'], dest: 'source_id' },
];

export const INVOICE_DEFAULT_MAPPINGS: PatternMap[] = [
  { sourcePatterns: ['invoice number', 'invoice no', 'invoice id', 'id', 'ref', 'reference'], dest: 'invoice_number' },
  { sourcePatterns: ['customer name', 'customer', 'client', 'bill to'], dest: 'customer_name' },
  { sourcePatterns: ['customer email', 'email', 'client email'], dest: 'customer_email' },
  { sourcePatterns: ['invoice date', 'date', 'issue date', 'issued'], dest: 'invoice_date' },
  { sourcePatterns: ['due date', 'payment due', 'due'], dest: 'due_date' },
  { sourcePatterns: ['status', 'invoice status', 'payment status'], dest: 'status' },
  { sourcePatterns: ['description', 'item', 'line item', 'service'], dest: 'description' },
  { sourcePatterns: ['quantity', 'qty'], dest: 'quantity' },
  { sourcePatterns: ['unit price', 'price', 'amount', 'rate', 'unit cost'], dest: 'unit_price' },
  { sourcePatterns: ['subtotal', 'sub total', 'before tax'], dest: 'subtotal' },
  { sourcePatterns: ['tax', 'gst', 'tax amount', 'tax rate'], dest: 'tax_rate' },
  { sourcePatterns: ['tax inclusive', 'inclusive', 'inc gst', 'inc tax'], dest: 'tax_inclusive' },
  { sourcePatterns: ['total', 'grand total', 'invoice total'], dest: 'total' },
  { sourcePatterns: ['notes', 'note', 'memo', 'comment'], dest: 'notes' },
];

export const PAYMENT_DEFAULT_MAPPINGS: PatternMap[] = [
  { sourcePatterns: ['invoice number', 'invoice no', 'invoice id', 'invoice ref'], dest: 'invoice_number' },
  { sourcePatterns: ['amount', 'payment amount', 'paid', 'value'], dest: 'amount' },
  { sourcePatterns: ['payment method', 'method', 'type', 'paid by', 'payment type'], dest: 'payment_method' },
  { sourcePatterns: ['payment date', 'date', 'paid date', 'received'], dest: 'payment_date' },
  { sourcePatterns: ['reference', 'ref', 'transaction id', 'receipt no', 'txn'], dest: 'reference' },
  { sourcePatterns: ['notes', 'note', 'comment'], dest: 'notes' },
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
    // Audit fix: pre-fix "POA" / "1k" / "TBD" / "N/A" / blank-ish values
    // silently became NULL with no signal to the operator — a wholesale
    // import of 500 items with cost_price="POA" (price-on-application)
    // would land 500 rows with cost_price=null and the operator would
    // never know the data was lost. Now: reject explicitly so the row
    // surfaces as an error with the raw input in the message.
    const cleaned = strVal.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && isFinite(num) && /^-?\d*(\.\d+)?$/.test(cleaned)) return num;
    // Don't silently null — throw so the row error surfaces with context.
    throw new Error(`Cannot parse ${field}=\"${strVal}\" as number. Clean the source data (e.g. replace "POA"/"TBD"/"~5k" with explicit values or leave blank) and re-import.`);
  }

  const boolFields = ['deposit_paid', 'is_active', 'published'];
  if (boolFields.includes(field)) {
    return ['true', 'yes', '1', 'y'].includes(strVal.toLowerCase());
  }

  const dateFields = ['due_date', 'birthday', 'anniversary', 'invoice_date', 'created_at'];
  if (dateFields.includes(field)) {
    if (!strVal) return null;

    // Audit fix: pre-fix the parser tried `new Date(str)` first which
    // is locale-sensitive (V8 reads "03/13/2026" as Mar 13 in US-style
    // locales but the fallback rejected it because the second part
    // was 13 > 12), and the fallback assumed DD/MM/YYYY without checks
    // — silently NULLing US-formatted dates from US POS exports.
    //
    // New strategy:
    //   1. Prefer ISO-style YYYY-MM-DD (unambiguous).
    //   2. If split into 3 numeric parts AND first part is 4-digit → ISO.
    //   3. Else split by / - .: try BOTH DD/MM and MM/DD; if both produce
    //      a valid distinct date, throw an explicit ambiguity error so
    //      the operator picks. If only one is valid (e.g. day > 12),
    //      use that one. If neither, throw.

    const isoMatch = strVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [, y, m, dd] = isoMatch;
      const d = new Date(`${y}-${m.padStart(2,'0')}-${dd.padStart(2,'0')}`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    const parts = strVal.split(/[/\-.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map(p => p.trim());
      // Determine year: assume the 4-digit part is year.
      let year: string | null = null;
      let p1: string | null = null, p2: string | null = null;
      if (/^\d{4}$/.test(a)) { year = a; p1 = b; p2 = c; }
      else if (/^\d{4}$/.test(c)) { year = c; p1 = a; p2 = b; }
      else { year = (parseInt(c) < 50 ? `20${c.padStart(2,'0')}` : `19${c.padStart(2,'0')}`); p1 = a; p2 = b; }
      const n1 = parseInt(p1!);
      const n2 = parseInt(p2!);
      const tryBuild = (mm: number, dd: number) => {
        const s = `${year}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
        const d = new Date(s);
        return !isNaN(d.getTime()) && d.getMonth() + 1 === mm && d.getDate() === dd ? s : null;
      };
      const ddmm = tryBuild(n2, n1); // DD first, MM second
      const mmdd = tryBuild(n1, n2); // MM first, DD second
      if (ddmm && mmdd && ddmm !== mmdd) {
        throw new Error(`Ambiguous date "${strVal}" for field ${field}: could be DD/MM/YYYY (${ddmm}) or MM/DD/YYYY (${mmdd}). Re-export with ISO YYYY-MM-DD format and re-import.`);
      }
      if (ddmm) return ddmm;
      if (mmdd) return mmdd;
    }

    throw new Error(`Cannot parse ${field}="${strVal}" as a date. Use ISO YYYY-MM-DD format and re-import.`);
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
  mappedData: Record<string, any>,
  customerId?: string
): Promise<ImportResult> {
  try {
    if (ctx.dataScope === 'active') {
      const completedStages = ['collected', 'cancelled', 'archived', 'complete'];
      if (completedStages.some(s => String(mappedData.stage || '').toLowerCase().includes(s))) {
        return { status: 'skipped' };
      }
    }

    if (!mappedData.title && !mappedData.description) {
      return { status: 'error', error: 'Bespoke job missing title/description' };
    }

    const stageMap: Record<string, string> = {
      'intake': 'intake', 'received': 'intake',
      'assess': 'assessed', 'assessed': 'assessed',
      'quoted': 'quoted', 'approved': 'approved',
      'in progress': 'in_progress', 'in_progress': 'in_progress', 'inprogress': 'in_progress',
      'ready': 'ready', 'complete': 'ready', 'collected': 'collected',
    };
    const rawStage = String(mappedData.stage || 'intake').toLowerCase().trim();
    const stage = stageMap[rawStage] || 'in_progress';

    const { data: created, error } = await admin
      .from('bespoke_jobs')
      .insert({
        tenant_id: ctx.tenantId,
        customer_id: customerId || null,
        job_number: mappedData.job_number || null,
        title: mappedData.title || 'Imported bespoke job',
        jewellery_type: mappedData.jewellery_type || null,
        metal_type: mappedData.metal_type || null,
        metal_colour: mappedData.metal_colour || null,
        metal_purity: mappedData.metal_purity || null,
        stone_type: mappedData.stone_type || null,
        stone_carat: mappedData.stone_carat ? parseFloat(String(mappedData.stone_carat)) : null,
        ring_size: mappedData.ring_size || null,
        stage,
        priority: 'normal',
        quoted_price: mappedData.quoted_price ? parseFloat(String(mappedData.quoted_price)) : null,
        deposit_amount: mappedData.deposit ? parseFloat(String(mappedData.deposit)) : null,
        deposit_received: Boolean(parseFloat(String(mappedData.deposit || '0')) > 0),
        due_date: mappedData.due_date || null,
        description: mappedData.description || null,
        import_metadata: buildImportMetadata(ctx, row.sourceRowNumber, row.sourceExternalId),
      })
      .select('id')
      .single();

    if (error) return { status: 'error', error: error.message };
    return { status: 'success', recordId: (created as { id: string }).id };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function importSupplier(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ImportContext,
  row: ImportRow,
  mappedData: Record<string, any>
): Promise<ImportResult> {
  try {
    if (!mappedData.name) {
      return { status: 'error', error: 'Supplier missing name' };
    }

    // Duplicate check: by name exact match
    const { data: existing } = await admin
      .from('suppliers')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .ilike('name', mappedData.name)
      .maybeSingle();
    if (existing) return { status: 'duplicate', recordId: (existing as { id: string }).id };

    // Also check by email if available
    if (mappedData.email) {
      const { data: emailMatch } = await admin
        .from('suppliers')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('email', mappedData.email)
        .maybeSingle();
      if (emailMatch) return { status: 'duplicate', recordId: (emailMatch as { id: string }).id };
    }

    const { data: created, error } = await admin
      .from('suppliers')
      .insert({
        tenant_id: ctx.tenantId,
        name: mappedData.name,
        contact_name: mappedData.contact_name || null,
        email: mappedData.email || null,
        phone: mappedData.phone || null,
        website: mappedData.website || null,
        address: mappedData.address || null,
        notes: mappedData.notes || null,
        import_metadata: buildImportMetadata(ctx, row.sourceRowNumber, row.sourceExternalId),
      })
      .select('id')
      .single();

    if (error) return { status: 'error', error: error.message };
    return { status: 'success', recordId: (created as { id: string }).id };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function importInvoice(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ImportContext,
  row: ImportRow,
  mappedData: Record<string, any>,
  customerId?: string
): Promise<ImportResult & { invoiceNumber?: string }> {
  try {
    // Check for duplicate by invoice_number
    if (mappedData.invoice_number) {
      const { data: existing } = await admin
        .from('invoices')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('invoice_number', mappedData.invoice_number)
        .maybeSingle();
      if (existing) return { status: 'duplicate', recordId: (existing as { id: string }).id, invoiceNumber: mappedData.invoice_number };
    }

    // Calculate amounts
    const unitPrice = parseFloat(String(mappedData.unit_price || mappedData.total || '0')) || 0;
    const qty = parseFloat(String(mappedData.quantity || '1')) || 1;
    const lineTotal = unitPrice * qty;
    const taxRate = parseFloat(String(mappedData.tax_rate || '10')) || 10;
    const taxInclusive = ['true', 'yes', '1', 'y'].includes(String(mappedData.tax_inclusive || 'true').toLowerCase());

    let subtotal: number;
    let taxAmount: number;
    let total: number;

    if (mappedData.subtotal) {
      subtotal = parseFloat(String(mappedData.subtotal)) || lineTotal;
      taxAmount = taxInclusive ? (lineTotal - subtotal) : (subtotal * taxRate / 100);
      total = taxInclusive ? lineTotal : (subtotal + taxAmount);
    } else if (taxInclusive) {
      subtotal = lineTotal / (1 + taxRate / 100);
      taxAmount = lineTotal - subtotal;
      total = lineTotal;
    } else {
      subtotal = lineTotal;
      taxAmount = lineTotal * (taxRate / 100);
      total = lineTotal + taxAmount;
    }

    // Map status
    const statusMap: Record<string, string> = {
      'paid': 'paid', 'unpaid': 'unpaid', 'overdue': 'overdue',
      'partial': 'partial', 'partially paid': 'partial',
      'outstanding': 'unpaid', 'open': 'unpaid',
    };
    const rawStatus = String(mappedData.status || 'unpaid').toLowerCase().trim();
    const status = statusMap[rawStatus] || 'unpaid';

    // Always start amount_paid at 0 — payment records will drive the final value.
    // This prevents double-counting when both invoice status and payment records exist.
    const amountPaid = 0;

    // Insert invoice — NEVER insert amount_due (it's GENERATED ALWAYS)
    const { data: invoice, error: invoiceError } = await admin
      .from('invoices')
      .insert({
        tenant_id: ctx.tenantId,
        invoice_number: mappedData.invoice_number || null,
        customer_id: customerId || null,
        status,
        invoice_date: mappedData.invoice_date || new Date().toISOString().split('T')[0],
        due_date: mappedData.due_date || null,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        amount_paid: amountPaid,
        tax_rate: taxRate,
        tax_inclusive: taxInclusive,
        notes: mappedData.notes || null,
        import_metadata: buildImportMetadata(ctx, row.sourceRowNumber, row.sourceExternalId),
      })
      .select('id')
      .single();

    if (invoiceError) return { status: 'error', error: invoiceError.message };

    const invoiceId = (invoice as { id: string }).id;

    // Insert one line item
    const description = mappedData.description || 'Imported line item';
    await admin.from('invoice_line_items').insert({
      tenant_id: ctx.tenantId,
      invoice_id: invoiceId,
      description,
      quantity: qty,
      unit_price: unitPrice,
      discount_pct: 0,
      sort_order: 1,
    });

    return { status: 'success', recordId: invoiceId, invoiceNumber: mappedData.invoice_number };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function importPayment(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ImportContext,
  row: ImportRow,
  mappedData: Record<string, any>,
  invoiceId?: string
): Promise<ImportResult> {
  try {
    if (!invoiceId) {
      return { status: 'error', error: `Payment references unknown invoice: ${mappedData.invoice_number}` };
    }

    if (!mappedData.amount || parseFloat(String(mappedData.amount)) === 0) {
      return { status: 'skipped' };
    }

    const amount = parseFloat(String(mappedData.amount));

    // Insert payment — payments table has NO import_metadata column
    const { data: payment, error } = await admin
      .from('payments')
      .insert({
        tenant_id: ctx.tenantId,
        invoice_id: invoiceId,
        amount,
        payment_method: mappedData.payment_method || 'other',
        payment_date: mappedData.payment_date || new Date().toISOString().split('T')[0],
        reference: mappedData.reference || null,
        notes: mappedData.notes || null,
      })
      .select('id')
      .single();

    if (error) return { status: 'error', error: error.message };

    // Update invoice.amount_paid by incrementing
    const { data: currentInvoice } = await admin
      .from('invoices')
      .select('amount_paid, total, status')
      .eq('id', invoiceId)
      .single();

    if (currentInvoice) {
      const inv = currentInvoice as { amount_paid: number; total: number; status: string };
      const newAmountPaid = (inv.amount_paid || 0) + amount;
      const newStatus = newAmountPaid >= inv.total ? 'paid'
        : newAmountPaid > 0 ? 'partial'
        : inv.status;

      await admin.from('invoices').update({
        amount_paid: Math.round(newAmountPaid * 100) / 100,
        status: newStatus,
        ...(newStatus === 'paid' ? { paid_at: mappedData.payment_date || new Date().toISOString() } : {}),
      }).eq('id', invoiceId);
    }

    return { status: 'success', recordId: (payment as { id: string }).id };
  } catch (e) {
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

/**
 * Parse a JSON file into a ParsedFile structure.
 * Supports:
 *   - Array of objects: [{"name":"foo",...}, ...]
 *   - Object with a single array property: {"items":[...]} — the first array found is used
 */
export function parseJSONFull(text: string): ParsedFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  let rows: Record<string, unknown>[] = [];

  if (Array.isArray(parsed)) {
    rows = parsed.map((item) => (typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}));
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Find the first array-valued property
    const arrayProp = Object.values(parsed as Record<string, unknown>).find(Array.isArray);
    if (Array.isArray(arrayProp)) {
      rows = arrayProp.map((item) => (typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}));
    } else {
      // Treat the whole object as a single row
      rows = [parsed as Record<string, unknown>];
    }
  }

  if (rows.length === 0) return { headers: [], rows: [], rowCount: 0 };

  // Derive headers from all keys across all rows (union)
  const headerSet = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);

  // Normalise rows to have all headers
  const normalisedRows = rows.map((row) => {
    const out: Record<string, unknown> = {};
    headers.forEach((h) => { out[h] = row[h] ?? ''; });
    return out;
  });

  return { headers, rows: normalisedRows, rowCount: normalisedRows.length };
}

export async function parseXLSXFull(buffer: Uint8Array): Promise<ParsedFile> {
  // Dynamic import to avoid bundling issues in edge runtime
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  // Convert to ArrayBuffer for exceljs compatibility
  await workbook.xlsx.load(buffer.buffer as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  // Get headers from first row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cell.value ? String(cell.value) : `Column${colNumber}`;
  });

  // Get data rows
  const rows: Record<string, unknown>[] = [];
  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const rowData: Record<string, unknown> = {};
    let hasData = false;
    
    headers.forEach((header, idx) => {
      const cell = row.getCell(idx + 1);
      const value = cell.value;
      if (value !== null && value !== undefined && value !== '') {
        hasData = true;
      }
      rowData[header] = value ?? '';
    });
    
    if (hasData) {
      rows.push(rowData);
    }
  }

  return { headers, rows, rowCount: rows.length };
}
