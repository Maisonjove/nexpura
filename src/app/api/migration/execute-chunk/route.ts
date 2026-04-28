import { NextRequest, NextResponse } from 'next/server';
import { runChunkContinue } from '@/lib/migration/chunk-runner';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return runChunkContinue(req, body);
}
