import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/high-scale";


/**
 * Health check endpoint for load balancers and monitoring.
 * Returns 200 if system is healthy, 503 if degraded.
 */
export async function GET() {
  const start = Date.now();
  
  try {
    const dbHealth = await checkDatabaseHealth();
    
    const health = {
      status: dbHealth.healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbHealth.healthy ? "pass" : "fail",
          latencyMs: dbHealth.latencyMs,
        },
      },
      responseTimeMs: Date.now() - start,
    };

    return NextResponse.json(health, {
      status: dbHealth.healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        responseTimeMs: Date.now() - start,
      },
      { status: 503 }
    );
  }
}

// HEAD requests use the same logic as GET (Next.js edge runtime does not auto-delegate)
export { GET as HEAD };
