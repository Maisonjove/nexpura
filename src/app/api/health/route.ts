import { NextResponse } from 'next/server';

/**
 * Simple health check endpoint for connectivity verification.
 * Used by the PWA offline detection to verify real connectivity
 * since navigator.onLine can give false negatives.
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: Date.now() });
}
