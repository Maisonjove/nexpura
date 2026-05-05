import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * /admin/health — operational dashboard for the platform's
 * technical health (vs /admin/ops which surfaces business-state
 * issues like past-due billing + stuck repairs).
 *
 * Section 4 #9. Read-only. Polls each section per page load (no
 * client-side polling — admins refresh manually if they want a
 * fresh read).
 *
 * Sections:
 *   1. Database — connection + latency probe.
 *   2. Email send health — % of last-24h sends that succeeded,
 *      with a sample of recent failures.
 *   3. Migration jobs — recent failures + stuck states.
 *
 * Admin-only — the (admin) layout enforces super_admin via
 * assertSuperAdmin() before this page renders.
 */

export const metadata = { title: "Health dashboard — Nexpura Admin" };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function AdminHealthPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Health</h1>
        <p className="text-stone-500 text-sm mt-1">
          Technical signals: database, email delivery, migration jobs.
          For billing + business-state issues see <Link href="/admin/ops" className="underline">/admin/ops</Link>.
        </p>
      </header>

      <Suspense fallback={<LoadingBlock label="Database" />}>
        <DatabaseSection />
      </Suspense>

      <Suspense fallback={<LoadingBlock label="Email delivery" />}>
        <EmailSendsSection />
      </Suspense>

      <Suspense fallback={<LoadingBlock label="Migration jobs" />}>
        <MigrationJobsSection />
      </Suspense>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <section className="border border-stone-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-stone-900">{label}</h2>
      <p className="text-stone-400 text-sm mt-2">Loading…</p>
    </section>
  );
}

async function DatabaseSection() {
  await connection();
  const admin = createAdminClient();
  const start = Date.now();
  // Cheap probe — single tenants count, hits the index.
  const { error } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .limit(1);
  const latencyMs = Date.now() - start;
  const healthy = !error;

  return (
    <section className="border border-stone-200 rounded-lg p-6">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-900">Database</h2>
        <span className={`text-sm font-medium ${healthy ? "text-emerald-700" : "text-red-700"}`}>
          {healthy ? "Healthy" : "Degraded"}
        </span>
      </header>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Probe latency</dt>
          <dd className={`font-mono text-lg mt-1 ${latencyMs < 200 ? "text-stone-900" : latencyMs < 500 ? "text-amber-700" : "text-red-700"}`}>
            {latencyMs}ms
          </dd>
        </div>
        {error && (
          <div className="col-span-2 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <p className="text-xs font-medium text-red-700">Error</p>
            <p className="text-xs text-red-600 mt-0.5 font-mono">{error.message}</p>
          </div>
        )}
      </dl>
    </section>
  );
}

async function EmailSendsSection() {
  await connection();
  const admin = createAdminClient();
  const since = new Date(Date.now() - ONE_DAY_MS).toISOString();
  const { data: rows, error } = await admin
    .from("email_sends")
    .select("status, error_message, email, subject, sent_at, tenants(name, business_name)")
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(500);

  const all = rows ?? [];
  const total = all.length;
  const failed = all.filter((r) => r.status === "failed").length;
  const sent = total - failed;
  const successRate = total > 0 ? Math.round((sent / total) * 1000) / 10 : null;

  const recentFailures = all.filter((r) => r.status === "failed").slice(0, 10);

  return (
    <section className="border border-stone-200 rounded-lg p-6">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-900">Email delivery (last 24h)</h2>
        <span
          className={`text-sm font-medium ${
            successRate === null
              ? "text-stone-500"
              : successRate >= 98
                ? "text-emerald-700"
                : successRate >= 90
                  ? "text-amber-700"
                  : "text-red-700"
          }`}
        >
          {successRate === null ? "No traffic" : `${successRate}% success`}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-4 text-sm mb-4">
        <Stat label="Sent" value={sent} />
        <Stat label="Failed" value={failed} accent={failed > 0 ? "bad" : "ok"} />
        <Stat label="Total attempts" value={total} />
      </dl>

      {error ? (
        <p className="text-xs text-red-600 font-mono">{error.message}</p>
      ) : recentFailures.length === 0 ? (
        <p className="text-sm text-stone-500">No failed sends in the last 24h.</p>
      ) : (
        <details className="mt-4">
          <summary className="text-xs text-stone-500 hover:text-stone-900 cursor-pointer transition-colors">
            Recent failures ({recentFailures.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {recentFailures.map((r, i) => {
              const tenant = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
              const tenantName = tenant?.business_name ?? tenant?.name ?? "—";
              return (
                <li
                  key={i}
                  className="text-xs font-mono bg-stone-50 border border-stone-100 rounded px-3 py-2"
                >
                  <div className="text-stone-700">
                    {tenantName} → <span className="text-stone-500">{r.email}</span>
                  </div>
                  <div className="text-stone-500 mt-0.5">{r.subject}</div>
                  {r.error_message && (
                    <div className="text-red-700 mt-1">{r.error_message}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

async function MigrationJobsSection() {
  await connection();
  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * ONE_DAY_MS).toISOString();
  const { data: rows, error } = await admin
    .from("migration_jobs")
    .select("id, tenant_id, status, started_at, completed_at, error_message, tenants(business_name, name)")
    .gte("started_at", since)
    .in("status", ["failed", "stuck", "running"])
    .order("started_at", { ascending: false })
    .limit(50);

  const all = rows ?? [];
  const failed = all.filter((j) => j.status === "failed");
  const stuck = all.filter((j) => j.status === "stuck");
  const running = all.filter((j) => j.status === "running");

  return (
    <section className="border border-stone-200 rounded-lg p-6">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-900">Migration jobs (last 7d)</h2>
        <span
          className={`text-sm font-medium ${failed.length === 0 && stuck.length === 0 ? "text-emerald-700" : "text-amber-700"}`}
        >
          {failed.length + stuck.length} need attention
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-4 text-sm mb-4">
        <Stat label="Running" value={running.length} />
        <Stat label="Failed" value={failed.length} accent={failed.length > 0 ? "bad" : "ok"} />
        <Stat label="Stuck" value={stuck.length} accent={stuck.length > 0 ? "bad" : "ok"} />
      </dl>

      {error ? (
        <p className="text-xs text-red-600 font-mono">{error.message}</p>
      ) : failed.length + stuck.length === 0 ? (
        <p className="text-sm text-stone-500">All recent migrations either completed cleanly or are still running.</p>
      ) : (
        <ul className="space-y-2">
          {[...failed, ...stuck].map((job) => {
            const tenant = Array.isArray(job.tenants) ? job.tenants[0] : job.tenants;
            const tenantName = tenant?.business_name ?? tenant?.name ?? job.tenant_id?.slice(0, 8) ?? "—";
            return (
              <li
                key={job.id}
                className="text-xs font-mono bg-stone-50 border border-stone-100 rounded px-3 py-2"
              >
                <div className="text-stone-700">
                  <span className="font-medium">{job.status.toUpperCase()}</span> · {tenantName}
                </div>
                <div className="text-stone-500 mt-0.5">
                  Started {job.started_at ? new Date(job.started_at).toISOString() : "—"}
                </div>
                {job.error_message && (
                  <div className="text-red-700 mt-1 whitespace-pre-wrap break-all">
                    {job.error_message}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "ok" | "bad";
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd
        className={`font-mono text-lg mt-1 tabular-nums ${
          accent === "bad" ? "text-red-700" : accent === "ok" ? "text-emerald-700" : "text-stone-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
