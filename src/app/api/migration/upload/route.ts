import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
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

    // Rate limit file uploads per user
    const { success: rateLimitOk } = await checkRateLimit(`migration-upload:${user.id}`);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 });
    }

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
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(uint8);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          return NextResponse.json({ error: 'Excel file has no worksheets' }, { status: 400 });
        }
        
        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = cell.value ? String(cell.value) : `Column${colNumber}`;
        });
        
        // Get sample rows (rows 2-11)
        for (let rowNum = 2; rowNum <= Math.min(11, worksheet.rowCount); rowNum++) {
          const row = worksheet.getRow(rowNum);
          const rowData: unknown[] = [];
          headers.forEach((_, idx) => {
            const cell = row.getCell(idx + 1);
            rowData[idx] = cell.value ?? '';
          });
          sampleRows.push(rowData);
        }
        
        rowCount = Math.max(0, worksheet.rowCount - 1);
      } catch (e) {
        logger.error('XLSX parse error:', e);
        return NextResponse.json({ error: 'Failed to parse Excel file' }, { status: 400 });
      }
    } else if (fileName.endsWith('.json')) {
      try {
        const text = new TextDecoder('utf-8').decode(uint8);
        const parsed = JSON.parse(text);
        let items: Record<string, unknown>[] = [];
        if (Array.isArray(parsed)) {
          items = parsed.map((item) => (typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}));
        } else if (typeof parsed === 'object' && parsed !== null) {
          const arrayProp = Object.values(parsed as Record<string, unknown>).find(Array.isArray);
          if (Array.isArray(arrayProp)) {
            items = arrayProp.map((item) => (typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}));
          } else {
            items = [parsed as Record<string, unknown>];
          }
        }
        const headerSet = new Set<string>();
        items.forEach((row) => Object.keys(row).forEach((k) => headerSet.add(k)));
        headers = Array.from(headerSet);
        sampleRows = items.slice(0, 10).map((row) => headers.map((h) => row[h] ?? ''));
        rowCount = items.length;
      } catch (e) {
        logger.error('JSON parse error:', e);
        return NextResponse.json({ error: 'Failed to parse JSON file. Ensure it contains an array of objects or an object with an array property.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload CSV, Excel (.xlsx/.xls), or JSON (.json)' }, { status: 400 });
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
