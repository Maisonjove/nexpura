import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Simple CSV parser
function parseCSV(text: string): { headers: string[]; rows: any[][] } {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

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
  return { headers, rows };
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

    const tenantId = profile?.tenant_id;
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
    let sampleRows: any[][] = [];
    let rowCount = 0;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      const text = new TextDecoder('utf-8').decode(uint8);
      const parsed = parseCSV(text);
      headers = parsed.headers;
      sampleRows = parsed.rows;
      // Count rows
      rowCount = text.split('\n').filter(l => l.trim()).length - 1;
    }
    // Note: Excel parsing requires a library; for V1 we handle CSV primarily

    // Upload to Supabase Storage
    const storagePath = `${tenantId}/${sessionId}/${Date.now()}-${file.name}`;

    const { error: storageError } = await admin.storage
      .from('migration-files')
      .upload(storagePath, uint8, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

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
          fileId: fileRecord.id,
          fileName: file.name,
          headers,
          sampleRows,
          tenantId,
          sessionId,
        }),
      });
      if (classifyRes.ok) {
        const classifyData = await classifyRes.json();
        return NextResponse.json({ file: { ...fileRecord, ...classifyData }, success: true });
      }
    } catch {
      // Classification failed gracefully — file still uploaded
    }

    return NextResponse.json({ file: fileRecord, success: true });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
