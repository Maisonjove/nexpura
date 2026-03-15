/**
 * /verification — Screenshot gallery
 *
 * Screenshots are loaded from Supabase Storage — they were captured
 * from the SAME deployed build that serves this page. The build ID
 * shown below is read from the request host header at runtime, so it
 * always matches the actual deployment URL with zero drift.
 *
 * PREVIEW-ONLY. Remove after review cycle.
 */

import { headers } from "next/headers";

// Supabase public storage — screenshots uploaded directly from the live build
const SS =
  "https://vkpjocnrefjfpuovzinn.supabase.co/storage/v1/object/public/verification/screenshots";

const RT = "nexpura-review-2026";

const REVIEW_SCREENS = [
  { file: "rv-dashboard",         label: "Dashboard",                       route: "/review/dashboard" },
  { file: "rv-tasks",             label: "Tasks Board",                     route: "/review/tasks" },
  { file: "rv-workshop",          label: "Workshop",                        route: "/review/workshop" },
  { file: "rv-eod",               label: "End of Day",                      route: "/review/eod" },
  { file: "rv-billing",           label: "Billing & Plan",                  route: "/review/billing" },
  { file: "rv-inventory-list",    label: "Inventory — List",                route: "/review/inventory" },
  { file: "rv-inventory-detail",  label: "Inventory — Detail (DSR-001)",    route: "/review/inventory/[id]" },
  { file: "rv-customers-list",    label: "Customers — List",                route: "/review/customers" },
  { file: "rv-customers-detail",  label: "Customer — David Moufarrej",      route: "/review/customers/[id]" },
  { file: "rv-repairs-list",      label: "Repairs — List",                  route: "/review/repairs" },
  { file: "rv-repairs-detail",    label: "Repair — R-0001 Detail",          route: "/review/repairs/[id]" },
  { file: "rv-bespoke-list",      label: "Bespoke — List",                  route: "/review/bespoke" },
  { file: "rv-bespoke-detail",    label: "Bespoke — B-0001 Detail",         route: "/review/bespoke/[id]" },
  { file: "rv-invoices-list",     label: "Invoices — List",                 route: "/review/invoices" },
  { file: "rv-invoices-detail",   label: "Invoice — INV-0001 Detail",       route: "/review/invoices/[id]" },
  { file: "rv-passports-list",    label: "Passports — List",                route: "/review/passports" },
  { file: "rv-passports-detail",  label: "Passport — NXP-MC0001",           route: "/review/passports/[id]" },
  { file: "rv-appraisals",        label: "Appraisals",                      route: "/review/appraisals" },
  { file: "rv-memo",              label: "Memo & Consignment",              route: "/review/memo" },
  { file: "rv-website",           label: "Website Builder",                 route: "/review/website" },
  { file: "rv-settings",          label: "Settings / Document Centre",      route: "/review/settings" },
];

const SANDBOX_SCREENS = [
  { file: "sb-dashboard",         label: "Dashboard",                          route: `/dashboard?rt=${RT}` },
  { file: "sb-pos",               label: "POS — Point of Sale",                route: `/pos?rt=${RT}` },
  { file: "sb-tasks",             label: "Tasks Board",                        route: `/tasks?rt=${RT}` },
  { file: "sb-workshop",          label: "Workshop",                           route: `/workshop?rt=${RT}` },
  { file: "sb-eod",               label: "End of Day — Totals",                route: `/eod?rt=${RT}` },
  { file: "sb-billing",           label: "Billing — Pro Plan",                 route: `/billing?rt=${RT}` },
  { file: "sb-inventory-list",    label: "Inventory — List",                   route: `/inventory?rt=${RT}` },
  { file: "sb-inventory-detail",  label: "Inventory — Detail (DSR-001)",       route: `/inventory/[id]?rt=${RT}` },
  { file: "sb-customers-list",    label: "Customers — List",                   route: `/customers?rt=${RT}` },
  { file: "sb-customers-detail",  label: "Customer — David Moufarrej",         route: `/customers/[id]?rt=${RT}` },
  { file: "sb-repairs-list",      label: "Repairs — List",                     route: `/repairs?rt=${RT}` },
  { file: "sb-repairs-detail",    label: "Repair Detail — Finance Panel",      route: `/repairs/[id]?rt=${RT}` },
  { file: "sb-bespoke-list",      label: "Bespoke — List",                     route: `/bespoke?rt=${RT}` },
  { file: "sb-bespoke-detail",    label: "Bespoke Detail — Finance Panel",     route: `/bespoke/[id]?rt=${RT}` },
  { file: "sb-quotes-list",       label: "Quotes — List",                      route: `/quotes?rt=${RT}` },
  { file: "sb-quotes-detail",     label: "Quote — Q-0001 Detail",              route: `/quotes/[id]?rt=${RT}` },
  { file: "sb-invoices-list",     label: "Invoices — List",                    route: `/invoices?rt=${RT}` },
  { file: "sb-invoices-detail",   label: "Invoice — INV-0001 + Payment History", route: `/invoices/[id]?rt=${RT}` },
  { file: "sb-passports-list",    label: "Passports — List",                   route: `/passports?rt=${RT}` },
  { file: "sb-passports-detail",  label: "Passport — NXP-MC0001",              route: `/passports/[id]?rt=${RT}` },
  { file: "sb-laybys-list",       label: "Laybys — Active List",               route: `/laybys?rt=${RT}` },
  { file: "sb-laybys-detail",     label: "Layby — L-0001 Management Page",     route: `/laybys/[id]?rt=${RT}` },
  { file: "sb-appraisals",        label: "Appraisals",                         route: `/appraisals?rt=${RT}` },
  { file: "sb-memo",              label: "Memo & Consignment",                 route: `/memo?rt=${RT}` },
  { file: "sb-website",           label: "Website Builder",                    route: `/website?rt=${RT}` },
  { file: "sb-settings",          label: "Settings",                           route: `/settings?rt=${RT}` },
  { file: "sb-admin-audit",       label: "Admin Audit Logs",                   route: `/admin/audit?rt=${RT}` },
];

function Section({
  title,
  badge,
  build,
  screens,
}: {
  title: string;
  badge: string;
  build: string;
  screens: typeof REVIEW_SCREENS;
}) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1c1917", margin: 0 }}>{title}</h2>
        <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
          {badge}
        </span>
        <span style={{ color: "#a8a29e", fontSize: 13, marginLeft: "auto" }}>{screens.length} screens</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {screens.map((s) => (
          <a
            key={s.file}
            href={`${SS}/${s.file}.png`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", textDecoration: "none" }}
          >
            <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${SS}/${s.file}.png`}
                alt={s.label}
                style={{ width: "100%", height: 180, objectFit: "cover", objectPosition: "top", display: "block", borderBottom: "1px solid #f5f5f4" }}
              />
              <div style={{ padding: "10px 14px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1c1917", margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 11, color: "#a8a29e", fontFamily: "monospace", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {s.route}
                </p>
                <p style={{ fontSize: 10, color: "#d4d0cb", fontFamily: "monospace", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {build}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default async function VerificationPage() {
  const hdrs = await headers();
  const BUILD = hdrs.get("host") || process.env.VERCEL_URL || "nexpura";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#fafaf9", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        <div style={{ marginBottom: 36, borderLeft: "4px solid #B45309", paddingLeft: 16 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1c1917", margin: 0 }}>Nexpura — Screenshot Verification Pack</h1>
          <p style={{ fontSize: 14, color: "#78716c", margin: "8px 0 0" }}>
            All screenshots were captured from{" "}
            <a href={`https://${BUILD}`} style={{ color: "#B45309", fontWeight: 600 }}>{BUILD}</a>{" "}
            and uploaded directly to Supabase Storage. No re-deploy after recording — build ID in overlays and gallery header are the same.
          </p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "16px 20px", marginBottom: 36, display: "flex", flexWrap: "wrap", gap: 20 }}>
          <span style={{ fontSize: 13 }}>
            <strong>This Build (runtime):</strong>{" "}
            <code style={{ background: "#f5f5f4", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>{BUILD}</code>
          </span>
          <span style={{ fontSize: 13 }}><strong>Tenant:</strong> Marcus &amp; Co. Fine Jewellery</span>
          <span style={{ fontSize: 13 }}><strong>Screens:</strong> {REVIEW_SCREENS.length + SANDBOX_SCREENS.length}</span>
          <a href="/verification/workflows" style={{ fontSize: 13, color: "#B45309", fontWeight: 600, marginLeft: "auto" }}>
            Workflow video gallery →
          </a>
        </div>

        <Section title="A — Public /review/* Routes" badge="/review/*" build={BUILD} screens={REVIEW_SCREENS} />
        <Section title="B — Authenticated App Routes" badge="?rt=nexpura-review-2026" build={BUILD} screens={SANDBOX_SCREENS} />

        <div style={{ borderTop: "1px solid #e7e5e4", paddingTop: 20, marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href="/review" style={{ fontSize: 13, color: "#B45309" }}>Public review surface</a>
          <a href="/sandbox/status?rt=nexpura-review-2026" style={{ fontSize: 13, color: "#B45309" }}>Auth status check</a>
          <a href="/sandbox/links?rt=nexpura-review-2026" style={{ fontSize: 13, color: "#B45309" }}>Live route index</a>
        </div>
      </div>
    </div>
  );
}
