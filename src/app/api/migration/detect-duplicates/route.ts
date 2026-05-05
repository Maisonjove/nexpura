import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from "@/lib/rate-limit";
import {
  parseCSVFull,
  parseXLSXFull,
  parseJSONFull,
  applyMappings,
  buildDefaultMappings,
  CUSTOMER_DEFAULT_MAPPINGS,
  INVENTORY_DEFAULT_MAPPINGS,
  REPAIR_DEFAULT_MAPPINGS,
  type MappingEntry,
} from '@/lib/migration/engine';
import logger from "@/lib/logger";


import { withSentryFlush } from "@/lib/sentry-flush";

type EntityType = 'customers' | 'inventory' | 'repairs' | 'bespoke' | 'unknown';

interface MigrationFile {
  id: string;
  original_name: string;
  storage_path: string;
  detected_entity: EntityType | null;
  column_headers: string[] | null;
  migration_mappings?: Array<{ mappings: MappingEntry[] | null }>;
}

interface DuplicateCandidate {
  fileId: string;
  fileName: string;
  rowNumber: number;
  entity: string;
  matchReason: string;
  confidence: 'high' | 'medium' | 'low';
  existingRecordId: string;
  sourceData: Record<string, unknown>;
}

async function downloadFile(admin: ReturnType<typeof createAdminClient>, path: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await admin.storage.from('migration-files').download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch { return null; }
}

async function parseFile(admin: ReturnType<typeof createAdminClient>, file: MigrationFile): Promise<Array<Record<string, unknown>>> {
  const bytes = await downloadFile(admin, file.storage_path);
  if (!bytes) return [];
  const name = file.original_name.toLowerCase();
  if (name.endsWith('.csv')) return parseCSVFull(new TextDecoder('utf-8').decode(bytes)).rows;
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return (await parseXLSXFull(bytes)).rows;
  if (name.endsWith('.json')) {
    try {
      return parseJSONFull(new TextDecoder('utf-8').decode(bytes)).rows;
    } catch {
      return [];
    }
  }
  return [];
}

function getMappings(file: MigrationFile): MappingEntry[] {
  const stored = file.migration_mappings?.[0]?.mappings;
  if (stored && stored.length > 0) return stored;
  const headers = file.column_headers ?? [];
  const entity = file.detected_entity ?? 'unknown';
  if (entity === 'customers') return buildDefaultMappings(headers, CUSTOMER_DEFAULT_MAPPINGS);
  if (entity === 'inventory') return buildDefaultMappings(headers, INVENTORY_DEFAULT_MAPPINGS);
  if (entity === 'repairs' || entity === 'bespoke') return buildDefaultMappings(headers, REPAIR_DEFAULT_MAPPINGS);
  return [];
}

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

    const { sessionId } = await req.json() as { sessionId: string };
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // SECURITY: Verify session belongs to user's tenant
    const { data: session } = await admin
      .from('migration_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data: rawFiles } = await admin
      .from('migration_files')
      .select('*, migration_mappings(*)')
      .eq('session_id', sessionId)
      .eq('tenant_id', tenantId);

    const files = (rawFiles ?? []) as MigrationFile[];
    const duplicates: DuplicateCandidate[] = [];

    for (const file of files) {
      const entity = file.detected_entity ?? 'unknown';
      const rows = await parseFile(admin, file);
      const mappings = getMappings(file);

      // Cap at 500 rows for duplicate check
      const checkRows = rows.slice(0, 500);

      for (let i = 0; i < checkRows.length; i++) {
        const mapped = applyMappings(checkRows[i], mappings);

        if (entity === 'customers') {
          // Check by email
          if (mapped.email) {
            const { data: existing } = await admin
              .from('customers')
              .select('id, full_name, email')
              .eq('tenant_id', tenantId)
              .eq('email', mapped.email as string)
              .maybeSingle();

            if (existing) {
              duplicates.push({
                fileId: file.id,
                fileName: file.original_name,
                rowNumber: i + 1,
                entity,
                matchReason: `Email match: ${mapped.email}`,
                confidence: 'high',
                existingRecordId: (existing as { id: string }).id,
                sourceData: mapped,
              });
              continue;
            }
          }
          // Check by phone
          if (mapped.mobile || mapped.phone) {
            const phone = (mapped.mobile || mapped.phone) as string;
            const { data: existing } = await admin
              .from('customers')
              .select('id, full_name, mobile')
              .eq('tenant_id', tenantId)
              .eq('mobile', phone)
              .maybeSingle();

            if (existing) {
              duplicates.push({
                fileId: file.id,
                fileName: file.original_name,
                rowNumber: i + 1,
                entity,
                matchReason: `Phone match: ${phone}`,
                confidence: 'high',
                existingRecordId: (existing as { id: string }).id,
                sourceData: mapped,
              });
            }
          }
        } else if (entity === 'inventory') {
          if (mapped.sku) {
            const { data: existing } = await admin
              .from('inventory')
              .select('id, name, sku')
              .eq('tenant_id', tenantId)
              .eq('sku', mapped.sku as string)
              .maybeSingle();

            if (existing) {
              duplicates.push({
                fileId: file.id,
                fileName: file.original_name,
                rowNumber: i + 1,
                entity,
                matchReason: `SKU match: ${mapped.sku}`,
                confidence: 'high',
                existingRecordId: (existing as { id: string }).id,
                sourceData: mapped,
              });
              continue;
            }
          }
          if (mapped.barcode) {
            const { data: existing } = await admin
              .from('inventory')
              .select('id, name, barcode')
              .eq('tenant_id', tenantId)
              .eq('barcode', mapped.barcode as string)
              .maybeSingle();

            if (existing) {
              duplicates.push({
                fileId: file.id,
                fileName: file.original_name,
                rowNumber: i + 1,
                entity,
                matchReason: `Barcode match: ${mapped.barcode}`,
                confidence: 'high',
                existingRecordId: (existing as { id: string }).id,
                sourceData: mapped,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      duplicates,
      total_duplicates: duplicates.length,
      checked_files: files.length,
    });

  } catch (err: unknown) {
    // P2-A Item 9: log full err, return generic message.
    logger.error('Detect duplicates error:', err);
    return NextResponse.json(
      { error: 'Migration duplicate detection failed' },
      { status: 500 }
    );
  }
});
