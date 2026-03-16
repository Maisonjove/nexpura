import { headers } from "next/headers";

// Design Verification Gallery — build ID read from request host header at runtime — no drift.
// All 21 screenshots captured from the live frozen design build.

const SUPABASE_PUBLIC = "https://vkpjocnrefjfpuovzinn.supabase.co/storage/v1/object/public/verification";

const SCREENSHOTS = [
  { file: "DESIGN-01-home-hero.png",       label: "01. Home — Hero Section",                route: "/?rt=nexpura-review-2026" },
  { file: "DESIGN-02-home-modules.png",    label: "02. Home — Modules / CC Section",         route: "/?rt=nexpura-review-2026" },
  { file: "DESIGN-03-pricing.png",         label: "03. Pricing Page",                        route: "/pricing?rt=nexpura-review-2026" },
  { file: "DESIGN-04-switching.png",       label: "04. Switching Page",                      route: "/switching?rt=nexpura-review-2026" },
  { file: "DESIGN-05-contact.png",         label: "05. Contact / Demo Page",                 route: "/contact?rt=nexpura-review-2026" },
  { file: "DESIGN-06-features.png",        label: "06. Features Page",                       route: "/features?rt=nexpura-review-2026" },
  { file: "DESIGN-07-dashboard.png",       label: "07. Dashboard",                           route: "/dashboard?rt=nexpura-review-2026" },
  { file: "DESIGN-08-repair-cc.png",       label: "08. Repair Command Center (REP-001)",     route: "/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75?rt=nexpura-review-2026" },
  { file: "DESIGN-09-bespoke-cc.png",      label: "09. Bespoke Command Center (BES-001)",    route: "/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026" },
  { file: "DESIGN-10-pos.png",             label: "10. Point of Sale",                       route: "/pos?rt=nexpura-review-2026" },
  { file: "DESIGN-11-invoices.png",        label: "11. Invoices List",                       route: "/invoices?rt=nexpura-review-2026" },
  { file: "DESIGN-12-inventory.png",       label: "12. Inventory List",                      route: "/inventory?rt=nexpura-review-2026" },
  { file: "DESIGN-13-customers.png",       label: "13. Customers List",                      route: "/customers?rt=nexpura-review-2026" },
  { file: "DESIGN-14-migration-hub.png",   label: "14. Migration Hub",                       route: "/migration?rt=nexpura-review-2026" },
  { file: "DESIGN-15-migration-results.png", label: "15. Migration Results",                 route: "/migration/0042042d-515d-458c-8640-7d78f490c13d/results?rt=nexpura-review-2026" },
  { file: "DESIGN-16-suppliers.png",       label: "16. Suppliers",                           route: "/suppliers?rt=nexpura-review-2026" },
  { file: "DESIGN-17-tasks.png",           label: "17. Tasks",                               route: "/tasks?rt=nexpura-review-2026" },
  { file: "DESIGN-18-billing.png",         label: "18. Billing & Subscription",              route: "/billing?rt=nexpura-review-2026" },
  { file: "DESIGN-19-settings.png",        label: "19. Settings (→ login redirect)",         route: "/settings?rt=nexpura-review-2026" },
  { file: "DESIGN-20-review-repair.png",   label: "20. Review Mode — Repair Detail",        route: "/review/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75" },
  { file: "DESIGN-21-proof-gallery.png",   label: "21. Proof Gallery — Migration",          route: "/verification/migration?rt=nexpura-review-2026" },
];

export default async function DesignVerificationPage() {
  const hdrs = await headers();
  const BUILD = hdrs.get("host") || "nexpura";

  return (
    <div style={{ fontFamily: "sans-serif", padding: "40px", maxWidth: "1400px", margin: "0 auto", background: "#fafaf9" }}>
      <h1 style={{ color: "#1c1917", fontSize: "28px", fontWeight: 700 }}>Design Verification Gallery</h1>
      <p style={{ color: "#57534e", marginBottom: "8px" }}>
        Build: <code style={{ background: "#e7e5e4", padding: "1px 6px", borderRadius: "4px", fontSize: "12px" }}>{BUILD}</code>
      </p>
      <p style={{ color: "#57534e", fontSize: "13px", marginBottom: "32px" }}>
        21 design screenshots captured from the frozen pre-QA build. Palette: amber / stone / rose / emerald. No blue, indigo, or purple.
      </p>

      <section style={{ marginBottom: "40px" }}>
        <h2 style={{ color: "#292524", fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Live Routes</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "13px" }}>
          {SCREENSHOTS.map(({ label, route }) => (
            <a
              key={route}
              href={`https://${BUILD}${route}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#e7e5e4",
                color: "#1c1917",
                padding: "4px 10px",
                borderRadius: "6px",
                textDecoration: "none",
                border: "1px solid #d6d3d1",
              }}
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ color: "#292524", fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
          Screenshot Pack — 21 shots from {BUILD}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(560px, 1fr))", gap: "24px" }}>
          {SCREENSHOTS.map(({ file, label, route }) => (
            <div key={file} style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", border: "1px solid #e7e5e4", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <a href={`https://${BUILD}${route}`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`${SUPABASE_PUBLIC}/screenshots/design/${file}`}
                  alt={label}
                  style={{ width: "100%", display: "block" }}
                  loading="lazy"
                />
              </a>
              <div style={{ padding: "10px 14px", background: "#fafaf9", borderTop: "1px solid #f5f5f4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#78716c" }}>{label}</p>
                <a
                  href={`https://${BUILD}${route}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "11px", color: "#a78a47", textDecoration: "none", flexShrink: 0, marginLeft: "8px" }}
                >
                  Live →
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
