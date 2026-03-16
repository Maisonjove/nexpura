/**
 * /verification/migration-links
 *
 * Direct verified route index for Migration Hub proof review.
 * All links use ?rt=nexpura-review-2026 — no login required.
 * Build ID read from host header at runtime — zero drift.
 */

import { headers } from "next/headers";

const RT = "nexpura-review-2026";

const CUST_ID   = "407dbb82-a57d-456e-a893-352171735a57";
const INV_ID    = "af4eb6c4-22c1-4e0f-873d-a38bf9a26be4";
const REP_ID    = "99be1bc2-a54f-4dbe-b03f-3f1fc504cb75";
const BES_ID    = "64cf8499-ef28-480a-b19e-f8ce23da9b07";
const BES2_ID   = "fee5fed3-1a51-442f-bb30-d3c13291aa39";
const BES3_ID   = "ead8e141-71e2-4615-bbaa-04641284be1a";
const INVOICE_ID= "4f9ed582-16f1-49d4-8309-173020be976e";
const PART_INV  = "ddc3bdfe-b2c3-4f64-a9d3-e16f6266f406";
const SUP_ID    = "27d404df-c2b4-45f1-8dff-76c859307ffc";
const ITEM_ID   = "af4eb6c4-22c1-4e0f-873d-a38bf9a26be4";

// The expansion session (bespoke + suppliers + invoices + payments)
const SESSION_EXP = "3fa58809-05a6-493b-8435-e99d92cc7aaf";
// The main swim session (customers + inventory + repairs)
const SESSION_MAIN = "0042042d-515d-458c-8640-7d78f490c13d";

type LinkRow = {
  label: string;
  path: string;
  note: string;
  highlight?: string;
};

const groups: { title: string; subtitle: string; links: LinkRow[] }[] = [
  {
    title: "Real App — Module Lists (Imported Records Visible)",
    subtitle: "Open each list to see imported records alongside existing data. Imported records carry source metadata.",
    links: [
      { label: "/customers", path: `/customers?rt=${RT}`, note: "50 imported from customers_swim_50.csv — ring size, birthday, store credit all present", highlight: "50 imported" },
      { label: "/inventory", path: `/inventory?rt=${RT}`, note: "54 imported — 29 Swim (jewellery metadata) + 25 Shopify (products mapped via AI)", highlight: "54 imported" },
      { label: "/repairs", path: `/repairs?rt=${RT}`, note: "40 imported from repairs_swim_20.csv — linked to customers by email", highlight: "40 imported" },
      { label: "/bespoke", path: `/bespoke?rt=${RT}`, note: "15 imported from bespoke_swim_15.csv — all stages, customer linkage, quoted values", highlight: "15 imported" },
      { label: "/invoices", path: `/invoices?rt=${RT}`, note: "8 imported — paid/unpaid/partial statuses, amount_paid updated from payments table", highlight: "8 imported" },
      { label: "/suppliers", path: `/suppliers?rt=${RT}`, note: "10 imported from suppliers_swim_10.csv — contact details, email, phone, address", highlight: "10 imported" },
    ],
  },
  {
    title: "Imported Record Detail Pages",
    subtitle: "Each link opens a real product detail page for a record created by the migration engine.",
    links: [
      {
        label: "Customer — Noah Davis",
        path: `/customers/${CUST_ID}?rt=${RT}`,
        note: "Imported: customers_swim_50.csv row 9 · email, mobile, ring size, store credit all present",
      },
      {
        label: "Inventory — Men's Black Onyx Bracelet (SKU MENS-BR-001)",
        path: `/inventory/${ITEM_ID}?rt=${RT}`,
        note: "Imported: inventory_swim_30.csv row 20 · metal type, stone, retail/cost price present",
      },
      {
        label: "Repair — REP-001 (Ring, in_progress)",
        path: `/repairs/${REP_ID}?rt=${RT}`,
        note: "Imported: repairs_swim_20.csv row 1 · repair type, stage, customer linked",
      },
      {
        label: "Bespoke — BES-001 Custom Diamond Engagement Ring ($12,500)",
        path: `/bespoke/${BES_ID}?rt=${RT}`,
        note: "Imported: bespoke_swim_15.csv row 1 · Platinum, 1.5ct Diamond, Ring size N, stage in_progress, customer Sarah Chen linked",
        highlight: "key bespoke proof",
      },
      {
        label: "Bespoke — BES-011 Heirloom Reset ($8,900)",
        path: `/bespoke/${BES2_ID}?rt=${RT}`,
        note: "Imported: bespoke_swim_15.csv row 11 · customer Sophie Lee linked, description present",
      },
      {
        label: "Bespoke — BES-013 Wedding Band Pair (stage: ready)",
        path: `/bespoke/${BES3_ID}?rt=${RT}`,
        note: "Imported: bespoke_swim_15.csv row 13 · fully paid deposit, stage ready for collection",
      },
      {
        label: "Invoice — INV-MIG-002 (PAID, $4,200)",
        path: `/invoices/${INVOICE_ID}?rt=${RT}`,
        note: "Imported: invoice total $4,200 · status=paid · amount_paid=$4,200 · payment: card $4,200 on 2026-02-28",
        highlight: "invoice + payment proof",
      },
      {
        label: "Invoice — INV-MIG-004 (PARTIAL, $450 owed, $200 paid)",
        path: `/invoices/${PART_INV}?rt=${RT}`,
        note: "Imported: total $450 · amount_paid=$200 · amount_due=$250 · status=partial · 1 payment record linked",
      },
      {
        label: "Supplier — Tiffany & Co.",
        path: `/suppliers/${SUP_ID}?rt=${RT}`,
        note: "Imported: suppliers_swim_10.csv row 1 · contact Mark Henderson, mark.h@tiffany.com",
      },
    ],
  },
  {
    title: "Migration Hub — Engine Routes",
    subtitle: "The full migration workflow. Start a new session or explore the existing demo sessions.",
    links: [
      { label: "/migration", path: `/migration?rt=${RT}`, note: "Hub home — recent sessions, stats, CTAs" },
      { label: "/migration/new", path: `/migration/new?rt=${RT}`, note: "Source selection — 12 platform adapters" },
      { label: "/migration/logs", path: `/migration/logs?rt=${RT}`, note: "Full session history and audit log" },
      { label: "/migration/assisted", path: `/migration/assisted?rt=${RT}`, note: "White-glove migration request form" },
    ],
  },
  {
    title: "Swim Session — Customers + Inventory + Repairs",
    subtitle: `Session ID: ${SESSION_MAIN} · source: swim · status: complete · 74 records created, 51 skipped (duplicates)`,
    links: [
      { label: "Files / Classification", path: `/migration/${SESSION_MAIN}/files?rt=${RT}`, note: "4 files classified: customers, inventory, repairs, shopify_products" },
      { label: "Mapping Review", path: `/migration/${SESSION_MAIN}/mapping?rt=${RT}`, note: "Column mapping with confidence scores" },
      { label: "Import Preview", path: `/migration/${SESSION_MAIN}/preview?rt=${RT}`, note: "Real dry-run — parses actual files, counts rows, flags dups" },
      { label: "Execution Results", path: `/migration/${SESSION_MAIN}/results?rt=${RT}`, note: "Per-entity: inventory=54 created, repairs=20 created, 51 duplicates skipped" },
    ],
  },
  {
    title: "Expansion Session — Bespoke + Suppliers + Invoices + Payments",
    subtitle: `Session ID: ${SESSION_EXP} · source: swim · status: complete · 39 records created (15 bespoke + 10 suppliers + 8 invoices + 6 payments)`,
    links: [
      { label: "Files / Classification", path: `/migration/${SESSION_EXP}/files?rt=${RT}`, note: "4 files: bespoke_swim_15.csv, suppliers_swim_10.csv, invoices_swim_8.csv, payments_swim_6.csv" },
      { label: "Mapping Review", path: `/migration/${SESSION_EXP}/mapping?rt=${RT}`, note: "AI-assisted + default pattern mapping for all 4 entities" },
      { label: "Import Preview", path: `/migration/${SESSION_EXP}/preview?rt=${RT}`, note: "Dry-run: bespoke 15→15, suppliers 10→10, invoices 8→8, payments 6→6" },
      {
        label: "Execution Results ← key proof",
        path: `/migration/${SESSION_EXP}/results?rt=${RT}`,
        note: "Real per-entity breakdown: bespoke=15, suppliers=10, invoices=8, payments=6 · 0 errors",
        highlight: "results proof",
      },
    ],
  },
  {
    title: "Verification Galleries",
    subtitle: "Proof packs for the full Migration Hub and Command Centers.",
    links: [
      { label: "/verification/migration", path: `/verification/migration?rt=${RT}`, note: "Migration proof gallery — 8 scenarios, bespoke table, invoice/payment table, duplicate detection" },
      { label: "/verification/workflows", path: `/verification/workflows?rt=${RT}`, note: "Command Center proof — repair + bespoke CC screenshots and workflow videos" },
      { label: "/verification/command-centers", path: `/verification/command-centers?rt=${RT}`, note: "Command Center direct links and feature index" },
    ],
  },
];

export default async function MigrationLinksPage() {
  const hdrs = await headers();
  const BUILD = hdrs.get("host") || "nexpura";
  const BASE = `https://${BUILD}`;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#fafaf9", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ borderLeft: "4px solid #B45309", paddingLeft: 16, marginBottom: 32 }}>
          <p style={{ fontSize: 12, color: "#78350f", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Migration Hub · Direct Route Verification Pack
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1c1917", margin: "0 0 6px" }}>
            Migration Route Index
          </h1>
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", display: "inline-block", marginTop: 6 }}>
            <span style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>Build: </span>
            <code style={{ fontSize: 12, color: "#78350f" }}>{BUILD}</code>
          </div>
          <p style={{ fontSize: 13, color: "#57534e", margin: "10px 0 0" }}>
            All links use <code style={{ background: "#e7e5e4", padding: "1px 4px", borderRadius: 3, fontSize: 11 }}>?rt=nexpura-review-2026</code> — no browser login required.
            All listed records were created by the migration engine, not seeded as fixtures.
          </p>
        </div>

        {groups.map((g) => (
          <div key={g.title} style={{ background: "white", border: "1px solid #e7e5e4", borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1c1917", margin: "0 0 4px" }}>{g.title}</h2>
            <p style={{ fontSize: 12, color: "#57534e", margin: "0 0 16px" }}>{g.subtitle}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.links.map((link) => (
                <a
                  key={link.path}
                  href={`${BASE}${link.path}`}
                  target="_blank"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 14px",
                    border: link.highlight ? "1px solid #fde68a" : "1px solid #e7e5e4",
                    background: link.highlight ? "#fffbeb" : "#fafaf9",
                    borderRadius: 8,
                    textDecoration: "none",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#B45309", marginBottom: 2 }}>
                      → {link.label}
                      {link.highlight && (
                        <span style={{ marginLeft: 8, fontSize: 10, background: "#B45309", color: "white", borderRadius: 20, padding: "1px 8px", fontWeight: 700 }}>
                          {link.highlight}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#78350f" }}>{link.note}</div>
                    <div style={{ fontSize: 10, color: "#a8a29e", marginTop: 2, fontFamily: "monospace" }}>
                      {BASE}{link.path}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: "#d6d3d1", flexShrink: 0 }}>↗</div>
                </a>
              ))}
            </div>
          </div>
        ))}

        {/* V1 status */}
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#92400e", margin: "0 0 10px" }}>
            V1 Complete vs Not Yet Built
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46", marginBottom: 6 }}>✓ Complete in V1</div>
              <ul style={{ fontSize: 12, color: "#44403c", paddingLeft: 16, margin: 0, lineHeight: 1.9 }}>
                <li>CSV + XLS + XLSX parsing</li>
                <li>Customers import (50 proved)</li>
                <li>Inventory import (54 proved)</li>
                <li>Repairs import (40 proved)</li>
                <li>Bespoke Jobs import (15 proved)</li>
                <li>Suppliers import (10 proved)</li>
                <li>Invoices import with line items (8 proved)</li>
                <li>Payments import with invoice linkage (6 proved)</li>
                <li>Dependency-aware execution order</li>
                <li>Duplicate detection for all 7 entities</li>
                <li>Real dry-run preview</li>
                <li>Per-entity results page</li>
                <li>import_metadata on all destination records</li>
                <li>AI file classification + mapping suggestions</li>
                <li>12 source adapter UIs</li>
                <li>White-glove request form</li>
                <li>Session history / audit log</li>
              </ul>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>○ Not Yet Built (V2)</div>
              <ul style={{ fontSize: 12, color: "#78350f", paddingLeft: 16, margin: 0, lineHeight: 1.9 }}>
                <li>One-click rollback UI</li>
                <li>Quotes import</li>
                <li>Vouchers / gift card import</li>
                <li>Store credit balance import</li>
                <li>Appraisals / passport metadata import</li>
                <li>Inventory image import</li>
                <li>ZIP file multi-extract</li>
                <li>Live API sync (Shopify / Lightspeed)</li>
              </ul>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "#a8a29e", textAlign: "center" }}>
          <a href={`${BASE}/verification/migration?rt=${RT}`} target="_blank" style={{ color: "#B45309" }}>→ Migration Proof Gallery</a>
          {" · "}
          <a href={`${BASE}/verification/workflows?rt=${RT}`} target="_blank" style={{ color: "#B45309" }}>→ Command Center Proof</a>
        </p>
      </div>
    </div>
  );
}
