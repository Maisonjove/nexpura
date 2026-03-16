"use client";
/**
 * /sandbox/links — Reviewer route index
 *
 * Lists every real app route as a direct authenticated link using the
 * ?rt=nexpura-review-2026 token. All IDs are real seeded records.
 * No auth required to load this index — the links themselves carry the token.
 *
 * PREVIEW-ONLY. Remove after review cycle.
 */

const RT = "nexpura-review-2026";
const ST = "nexpura-staff-2026";

// Real record IDs — migrated import data, confirmed from DB 2026-03
const IDS = {
  inventory: "67940b89-90ed-43b7-96a5-7bfc14d1ed79",     // DSR-001 Diamond Solitaire Ring (seeded)
  customer: "407dbb82-a57d-456e-a893-352171735a57",        // Noah Davis (migrated — REP-001 customer)
  repair: "99be1bc2-a54f-4dbe-b03f-3f1fc504cb75",          // REP-001 (migrated)
  bespoke: "64cf8499-ef28-480a-b19e-f8ce23da9b07",          // BES-001 Custom Diamond Engagement Ring (migrated)
  quote: "2c6672d1-884e-4d96-accf-b8a88ab2e27e",           // Q-0001 (draft, seeded)
  invoice: "4f9ed582-16f1-49d4-8309-173020be976e",          // INV-MIG-002 (paid, migrated)
  supplier: "27d404df-c2b4-45f1-8dff-76c859307ffc",         // Tiffany & Co. (migrated)
  passport: "0f092b0f-7af3-4f42-9f9f-0ff21e9c111b",        // NXP-MC0001 Diamond Solitaire Ring
  appraisal: "86b26937-ddef-46d5-84a8-2c87fa62fe99",        // APR-0001
};

function u(path: string) {
  return `${path}?rt=${RT}`;
}

const SECTIONS = [
  {
    title: "Core Operations",
    color: "amber",
    links: [
      { label: "Dashboard", path: "/dashboard", note: "KPIs, tasks, alerts, repairs, bespoke overview" },
      { label: "POS — Point of Sale", path: "/pos", note: "Full sale flow, payment methods, inventory lookup" },
      { label: "Tasks", path: "/tasks", note: "10 operational tasks, due-today + upcoming" },
      { label: "Workshop", path: "/workshop", note: "Production overview — repairs + bespoke in progress" },
      { label: "End of Day", path: "/eod", note: "Cash reconciliation, payment breakdown" },
    ],
  },
  {
    title: "Inventory",
    color: "stone",
    links: [
      { label: "Inventory — List", path: "/inventory", note: "54 imported inventory items" },
      { label: "Inventory — Detail (DSR-001 Diamond Solitaire Ring)", path: `/inventory/${IDS.inventory}`, note: "Real item detail with specs, stock, movements" },
    ],
  },
  {
    title: "Customers",
    color: "stone",
    links: [
      { label: "Customers — List", path: "/customers", note: "50 imported customers" },
      { label: "Customer — Noah Davis", path: `/customers/${IDS.customer}`, note: "Migrated customer — linked to REP-001" },
    ],
  },
  {
    title: "Repairs",
    color: "stone",
    links: [
      { label: "Repairs — List", path: "/repairs", note: "40 imported repairs across all stages" },
      { label: "Repair — REP-001 Detail", path: `/repairs/${IDS.repair}`, note: "Migrated repair detail — stage workflow, invoice" },
    ],
  },
  {
    title: "Bespoke Jobs",
    color: "stone",
    links: [
      { label: "Bespoke — List", path: "/bespoke", note: "15 imported bespoke jobs" },
      { label: "Bespoke — BES-001 Detail", path: `/bespoke/${IDS.bespoke}`, note: "Custom Diamond Engagement Ring — migrated" },
    ],
  },
  {
    title: "Quotes & Invoices",
    color: "stone",
    links: [
      { label: "Quotes — List", path: "/quotes", note: "Draft/quote status invoices" },
      { label: "Quote — Q-0001 Detail", path: `/quotes/${IDS.quote}`, note: "Draft quote — Lina Haddad, $3,740" },
      { label: "Invoices — List", path: "/invoices", note: "8 imported invoices — paid, partial, unpaid" },
      { label: "Invoice — INV-MIG-002 Detail", path: `/invoices/${IDS.invoice}`, note: "Paid migrated invoice" },
    ],
  },
  {
    title: "Suppliers",
    color: "stone",
    links: [
      { label: "Suppliers — List", path: "/suppliers", note: "10 imported suppliers (Tiffany, Cartier, Palloys...)" },
      { label: "Supplier — Tiffany & Co. Detail", path: `/suppliers/${IDS.supplier}`, note: "Migrated supplier detail" },
    ],
  },
  {
    title: "Passports & Appraisals",
    color: "stone",
    links: [
      { label: "Passports — List", path: "/passports", note: "3 verified passports — NXP-MC0001/02/03" },
      { label: "Passport — NXP-MC0001 Detail", path: `/passports/${IDS.passport}`, note: "Diamond Solitaire Ring — David Moufarrej" },
      { label: "Appraisals — List", path: "/appraisals", note: "3 appraisals — issued, completed, in progress" },
    ],
  },
  {
    title: "Laybys",
    color: "stone",
    links: [
      { label: "Laybys — Active List", path: "/laybys", note: "L-0001: Lina Haddad, $2,200 total, $600 deposit paid" },
    ],
  },
  {
    title: "Financial & Reporting",
    color: "stone",
    links: [
      { label: "Memo / Consignment", path: "/memo", note: "1 memo out, 1 consignment in" },
      { label: "Financials / Reports", path: "/financials", note: "Revenue, P&L reporting" },
      { label: "Sales History", path: "/sales", note: "6 completed sales" },
    ],
  },
  {
    title: "Store & Configuration",
    color: "stone",
    links: [
      { label: "Website Builder", path: "/website", note: "Store config, domain, branding, pages" },
      { label: "Settings", path: "/settings", note: "Business profile, team, documents, printing" },
      { label: "Billing & Plan", path: "/billing", note: "Subscription, usage, plan comparison" },
    ],
  },
  {
    title: "Admin",
    color: "red",
    links: [
      { label: "Admin Audit Logs", path: "/admin/audit", note: "System-wide audit trail" },
    ],
  },
];

export default function SandboxLinksPage() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "0 auto", padding: "32px 24px", background: "#fafaf9", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ borderLeft: "4px solid #B45309", paddingLeft: 16, marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1c1917", margin: 0 }}>Nexpura — Reviewer Route Index</h1>
        <p style={{ fontSize: 14, color: "#78716c", margin: "6px 0 0" }}>
          All routes open the real authenticated app as the Marcus &amp; Co. demo owner.
          Token: <code style={{ background: "#f5f5f4", padding: "2px 6px", borderRadius: 4, fontSize: 12, color: "#92400e" }}>?rt={RT}</code>
        </p>
      </div>

      {/* Status bar */}
      <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, padding: "14px 18px", marginBottom: 28, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#57534e" }}>🏪 <strong>Tenant:</strong> Marcus &amp; Co. Fine Jewellery</span>
        <span style={{ fontSize: 13, color: "#57534e" }}>👤 <strong>User:</strong> demo@nexpura.com (Owner)</span>
        <span style={{ fontSize: 13, color: "#57534e" }}>🔐 <strong>Auth:</strong> Middleware injection — cookie-free</span>
        <a href={`/sandbox/status?rt=${RT}`} style={{ fontSize: 13, color: "#B45309", fontWeight: 600, marginLeft: "auto" }}>
          Verify status →
        </a>
      </div>

      {/* Staff access token */}
      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "14px 18px", marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#9a3412", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Staff Access (Permission Testing)</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#57534e" }}>👤 <strong>User:</strong> staff@nexpura.com (Staff — Sarah)</span>
          <span style={{ fontSize: 13, color: "#57534e" }}>🔑 <strong>Token:</strong> <code style={{ background: "#ffedd5", padding: "2px 6px", borderRadius: 4, fontSize: 12, color: "#9a3412" }}>{ST}</code></span>
          <a href={`/dashboard?rt=${ST}`} style={{ fontSize: 13, color: "#9a3412", fontWeight: 600, marginLeft: "auto" }}>
            Open as staff →
          </a>
        </div>
        <p style={{ fontSize: 12, color: "#a8a29e", margin: "8px 0 0" }}>
          Use <code style={{ background: "#f5f5f4", padding: "1px 4px", borderRadius: 3 }}>?rt={ST}</code> on any route to view as the staff/salesperson user. Useful for testing role-based permission enforcement.
        </p>
      </div>

      {/* Route sections */}
      {SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "#a8a29e", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            {section.title}
          </h2>
          <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, overflow: "hidden" }}>
            {section.links.map((link, i) => (
              <a
                key={link.path}
                href={u(link.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 18px",
                  borderBottom: i < section.links.length - 1 ? "1px solid #f5f5f4" : "none",
                  textDecoration: "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#fafaf9")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#fff")}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1c1917" }}>{link.label}</span>
                  <span style={{ fontSize: 12, color: "#a8a29e", marginLeft: 10 }}>{link.note}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <code style={{ fontSize: 11, color: "#78716c", background: "#f5f5f4", padding: "2px 8px", borderRadius: 4 }}>
                    {link.path}
                  </code>
                  <span style={{ color: "#B45309", fontSize: 14 }}>→</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div style={{ marginTop: 32, padding: "16px 0", borderTop: "1px solid #e7e5e4", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <a href={`/sandbox?rt=${RT}`} style={{ fontSize: 13, color: "#B45309" }}>← Sandbox entry</a>
        <a href={`/sandbox/status?rt=${RT}`} style={{ fontSize: 13, color: "#B45309" }}>Auth status check</a>
        <a href={`/sandbox/reset`} style={{ fontSize: 13, color: "#9ca3af" }}>Reset demo data</a>
        <a href="/review" style={{ fontSize: 13, color: "#9ca3af" }}>Public review surface →</a>
      </div>
    </div>
  );
}
