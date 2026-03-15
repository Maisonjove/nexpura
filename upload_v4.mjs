import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const DIR = '/root/.openclaw/workspace/clients/joey/projects/nexpura/videos_v4';

const supabase = createClient(URL, SVC);

async function upload() {
  const files = readdirSync(DIR).filter(f => f.endsWith('.webm'));
  console.log(`Found ${files.length} files in ${DIR}`);
  for (const f of files) {
    const path = join(DIR, f);
    const content = readFileSync(path);
    console.log(`Uploading ${f}...`);
    const { error, data } = await supabase.storage
      .from('verification')
      .upload(`videos/${f}`, content, {
        contentType: 'video/webm',
        upsert: true
      });
    if (error) console.error(`  ✗ Error: ${error.message}`);
    else console.log(`  ✓ Done: ${JSON.stringify(data)}`);
  }
}

upload();
