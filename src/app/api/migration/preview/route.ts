import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from "@/lib/rate-limit";
import {
  parseCSVFull,
  parseXLSXFull,
  applyMappings,
  buildDefaultMappings,
  findDuplicateCustomer,
  findDuplicateInventory,
  CUSTOMER_DEFAULT_MAPPINGS,
  INVENTORY_DEFAULT_MAPPINGS,
  REPAIR_DEFAULT_MAPPINGS,
  type MappingEntry,
} from '@/lib/migration/engine';
import logger from "@/lib/logger";


import { withSentryFlush } from "@/lib/sentry-flush";

type EntityType = 'customers' | 'inventory' | 'repairs' | 'bespoke' | 'invoices' | 'payments' | 'unknown';

interface MigrationFile {
  id: string;
  original_name: string;
  storage_path: string;
  detected_entity: EntityType | null;
  row_count: number | null;
  column_headers: string[] | null;
  migration_mappings?: Array<{ mappings: MappingEntry[] | null }>;
}

interface PreviewEntityStats {
  will_create: number;
  will_skip: number;
  duplicates: number;
  errors: number;
  sample_errors: string[];
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
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}

async function parseFile(admin: ReturnType<typeof createAdminClient>, file: MigrationFile): Promise<Array<Record<string, unknown>>> {
  const bytes = await downloadFile(admin, file.storage_path);
  if (!bytes) return [];
  const name = file.original_name.toLowerCase();
  if (name.endsWith('.csv')) {
    return parseCSVFull(new TextDecoder('utf-8').decode(bytes)).rows;
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return (await parseXLSXFull(bytes)).rows;
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

  // Half-fix-pair audit finding #5: mirror sibling /api/migration/upload
  // by keying rate-limit on user.id (auth check above guarantees user.id
  // is available). IP keying penalises shared-NAT users and is bypassable
  // by rotating x-forwarded-for.
  const { success } = await checkRateLimit(`migration-preview:${user.id}`, 'heavy');
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
    const preview: Record<string, PreviewEntityStats> = {};
    let totalWillCreate = 0;
    let totalDuplicates = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const file of files) {
      const entity = file.detected_entity ?? 'unknown';
      if (!preview[entity]) {
        preview[entity] = { will_create: 0, will_skip: 0, duplicates: 0, errors: 0, sample_errors: [] };
      }

      const rows = await parseFile(admin, file);
      const mappings = getMappings(file);

      // For preview: cap at 200 rows per file to keep it fast
      const sampleRows = rows.slice(0, 200);

      for (const row of sampleRows) {
        const mapped = applyMappings(row, mappings);

        if (entity === 'customers') {
          if (!mapped.full_name && !mapped.email && !mapped.mobile) {
            preview[entity].errors++;
            if (preview[entity].sample_errors.length < 5) {
              preview[entity].sample_errors.push('Missing name, email, and phone');
            }
            totalErrors++;
            continue;
          }
          const dup = await findDuplicateCustomer(admin, tenantId, {
            email: mapped.email as string | undefined,
            phone: (mapped.mobile || mapped.phone) as string | undefined,
          });
          if (dup) { preview[entity].duplicates++; totalDuplicates++; }
          else { preview[entity].will_create++; totalWillCreate++; }
        } else if (entity === 'inventory') {
          if (!mapped.name && !mapped.sku) {
            preview[entity].errors++;
            totalErrors++;
            continue;
          }
          const dup = await findDuplicateInventory(admin, tenantId, {
            sku: mapped.sku as string | undefined,
            barcode: mapped.barcode as string | undefined,
          });
          if (dup) { preview[entity].duplicates++; totalDuplicates++; }
          else { preview[entity].will_create++; totalWillCreate++; }
        } else if (entity === 'repairs' || entity === 'bespoke') {
          if (!mapped.item_description && !mapped.item_type) {
            preview[entity].errors++;
            totalErrors++;
          } else {
            preview[entity].will_create++;
            totalWillCreate++;
          }
        } else {
          preview[entity].will_skip++;
          totalSkipped++;
        }
      }

      // Scale up estimates for rows we didn't check
      if (rows.length > sampleRows.length) {
        const ratio = rows.length / sampleRows.length;
        preview[entity].will_create = Math.round(preview[entity].will_create * ratio);
        preview[entity].duplicates = Math.round(preview[entity].duplicates * ratio);
        preview[entity].errors = Math.round(preview[entity].errors * ratio);
      }
    }

    return NextResponse.json({
      success: true,
      preview,
      totals: {
        will_create: totalWillCreate,
        duplicates: totalDuplicates,
        skipped: totalSkipped,
        errors: totalErrors,
        files_analyzed: files.length,
      },
    });

  } catch (err: unknown) {
    // P2-A Item 9: log full err, return generic message.
    logger.error('Preview error:', err);
    return NextResponse.json(
      { error: 'Migration preview failed' },
      { status: 500 }
    );
  }
});
