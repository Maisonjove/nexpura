/**
 * Tiny `Server-Timing` builder.
 *
 * Emits the timing header browsers display under DevTools → Network →
 * a request's "Timing" tab. Format is well-defined by the W3C
 * Server-Timing spec — comma-separated metrics, each `name;dur=ms`
 * (no space inside the semicolon, no quotes around values).
 *
 * Usage in a Route Handler:
 *
 *   import { ServerTiming } from "@/lib/server-timing";
 *
 *   export async function GET(req: NextRequest) {
 *     const timing = new ServerTiming();
 *
 *     const auth = await timing.measure("auth", () => verifySession(req));
 *     if (!auth) return new NextResponse("Unauthorized", { status: 401 });
 *
 *     const data = await timing.measure("db", () => readDashboardStats(auth.tenantId));
 *
 *     return NextResponse.json(data, {
 *       headers: { "Server-Timing": timing.toHeader() },
 *     });
 *   }
 *
 * Phase E observability — gives Joey + the client tooling a per-route
 * breakdown of where server time goes (auth gate vs DB read vs render
 * vs Sentry flush) without needing to bolt on full APM.
 */

interface TimingMetric {
  name: string;
  durationMs: number;
}

export class ServerTiming {
  private metrics: TimingMetric[] = [];

  /**
   * Record a measured duration directly.
   *
   * Useful when the work being timed isn't a single function (e.g.
   * sum of several parallel queries, or a duration computed by an
   * upstream library that already emits its own timer).
   */
  record(name: string, durationMs: number): void {
    if (!isValidMetricName(name)) {
      throw new Error(`ServerTiming: invalid metric name "${name}". Allowed: alphanumeric + underscore, max 64 chars.`);
    }
    this.metrics.push({
      name,
      durationMs: Math.max(0, Math.round(durationMs * 100) / 100),
    });
  }

  /**
   * Time an async function and append its duration as a metric.
   * Returns the function's own resolved value.
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.record(name, performance.now() - start);
    }
  }

  /**
   * Time a sync function — same API as measure() for consistency.
   */
  measureSync<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      this.record(name, performance.now() - start);
    }
  }

  /**
   * Render the canonical `Server-Timing` header value.
   * Returns "" when no metrics were recorded so callers can
   * conditionally skip setting the header.
   */
  toHeader(): string {
    if (this.metrics.length === 0) return "";
    return this.metrics
      .map((m) => `${m.name};dur=${m.durationMs}`)
      .join(", ");
  }

  /** Read access for tests + telemetry. */
  snapshot(): readonly TimingMetric[] {
    return this.metrics;
  }
}

// W3C Server-Timing names: `token` = 1*<VCHAR, except delimiters>.
// Restrict to a friendly subset — alphanumeric + underscore, capped
// at 64 chars — so we never accidentally produce a header value that
// browsers reject and users see no breadcrumbs at all.
const METRIC_NAME_RE = /^[A-Za-z0-9_]{1,64}$/;
function isValidMetricName(name: string): boolean {
  return METRIC_NAME_RE.test(name);
}
