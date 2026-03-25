import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from "@/lib/logger";

export const runtime = 'nodejs';

// Simple CSV parser (header + sample only)
function parseCSVSample(text: string): { headers: string[]; rows: unknown[][]; rowCount: number } {
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
  const rows = lines.slice(1, 11).map(l => parseLine(l));
  const rowCount = lines.length - 1;
  return { headers, rows, rowCount };
}

export async function POST(req: NextRequest) {
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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

    if (!file || !sessionId) {
      return NextResponse.json({ error: 'Missing file or sessionId' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Read file content
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    let headers: string[] = [];
    let sampleRows: unknown[][] = [];
    let rowCount = 0;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      const text = new TextDecoder('utf-8').decode(uint8);
      const parsed = parseCSVSample(text);
      headers = parsed.headers;
      sampleRows = parsed.rows;
      rowCount = parsed.rowCount;
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(uint8, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        headers = (jsonData[0] as unknown[] ?? []).map(String);
        sampleRows = jsonData.slice(1, 11) as unknown[][];
        rowCount = Math.max(0, jsonData.length - 1);
      } catch (e) {
        logger.error('XLSX parse error:', e);
        return NextResponse.json({ error: 'Failed to parse Excel file' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload CSV or Excel (.xlsx/.xls)' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const storagePath = `${tenantId}/${sessionId}/${Date.now()}-${file.name}`;

    const { error: storageError } = await admin.storage
      .from('migration-files')
      .upload(storagePath, uint8, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (storageError) {
      logger.error('Storage upload error:', storageError);
      // Non-fatal — still create the DB record
    }

    // Create migration_files record
    const { data: fileRecord, error: dbError } = await admin
      .from('migration_files')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        original_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        column_headers: headers,
        sample_rows: sampleRows,
        row_count: rowCount,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Trigger AI classification asynchronously
    try {
      const classifyRes = await fetch(`${req.nextUrl.origin}/api/migration/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
        body: JSON.stringify({
          fileId: (fileRecord as { id: string }).id,
          fileName: file.name,
          headers,
          sampleRows,
          tenantId,
          sessionId,
        }),
      });
      if (classifyRes.ok) {
        const classifyData = await classifyRes.json();
        return NextResponse.json({ file: { ...(fileRecord as object), ...classifyData }, success: true });
      }
    } catch {
      // Classification failed gracefully — file still uploaded
    }

    return NextResponse.json({ file: fileRecord, success: true });
  } catch (err: unknown) {
    logger.error('Upload error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
