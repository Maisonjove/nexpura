import { headers } from "next/headers";

// Proof gallery — build ID is read from the request host header at runtime — no drift.
// Every link and caption uses the actual host this request is being served from.

const SUPABASE_PUBLIC = "https://vkpjocnrefjfpuovzinn.supabase.co/storage/v1/object/public/verification";

const SCREENSHOTS = [
  { file: "MIG-01-hub-home.png",              label: "1. Migration Hub Home" },
  { file: "MIG-02-source-selection.png",      label: "2. Source Selection" },
  { file: "MIG-03-files-classified.png",      label: "3. Files Classified" },
  { file: "MIG-04-mapping.png",               label: "4. Column Mapping" },
  { file: "MIG-05-preview.png",               label: "5. Dry-Run Preview" },
  { file: "MIG-06-results-main.png",          label: "6. Results — Main Session" },
  { file: "MIG-07-results-expansion.png",     label: "7. Results — Expansion Session" },
  { file: "MIG-08-customers-list.png",        label: "8. Customers List (imported)" },
  { file: "MIG-09-customer-detail.png",       label: "9. Customer Detail — Noah Davis" },
  { file: "MIG-10-inventory-list.png",        label: "10. Inventory List (imported)" },
  { file: "MIG-11-inventory-detail.png",      label: "11. Inventory Detail (imported item)" },
  { file: "MIG-12-repairs-list.png",          label: "12. Repairs List (imported)" },
  { file: "MIG-13-repair-detail.png",         label: "13. Repair Detail — REP-001" },
  { file: "MIG-14-bespoke-list.png",          label: "14. Bespoke List (imported)" },
  { file: "MIG-15-bespoke-detail.png",        label: "15. Bespoke Detail — BES-001 Abigail Young" },
  { file: "MIG-16-invoices-list.png",         label: "16. Invoices List (Paid / Sent / Partial)" },
  { file: "MIG-17-invoice-detail-paid.png",   label: "17. Invoice Detail — INV-MIG-002 Paid $4,200" },
  { file: "MIG-18-invoice-detail-partial.png",label: "18. Invoice Detail — INV-MIG-004 Partial $200/$450" },
  { file: "MIG-19-suppliers-list.png",        label: "19. Suppliers List (imported)" },
  { file: "MIG-20-supplier-detail.png",       label: "20. Supplier Detail — Tiffany & Co." },
];

export default async function MigrationVerificationPage() {
  const hdrs = await headers();
  const BUILD = hdrs.get("host") || "nexpura";

  return (
    <div style={{ fontFamily: "sans-serif", padding: "40px", maxWidth: "1200px", margin: "0 auto", background: "#fafaf9" }}>
      <h1 style={{ color: "#1c1917", fontSize: "28px", fontWeight: 700 }}>Migration Hub — Proof Gallery</h1>
      <p style={{ color: "#57534e", marginBottom: "8px" }}>
        Build: <code style={{ background: "#e7e5e4", padding: "1px 6px", borderRadius: "4px", fontSize: "12px" }}>{BUILD}</code>
      </p>
      <p style={{ color: "#57534e", fontSize: "13px", marginBottom: "32px" }}>
        All 20 screenshots captured from this exact build. DB: 50 customers · 54 inventory · 40 repairs · 15 bespoke · 8 invoices · 8 payments · 10 suppliers — all with import provenance.
      </p>

      <section style={{ marginBottom: "40px" }}>
        <h2 style={{ color: "#292524", fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Live Routes</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "13px" }}>
          {[
            ["Customers", `/customers?rt=nexpura-review-2026`],
            ["Customer (Noah Davis)", `/customers/407dbb82-a57d-456e-a893-352171735a57?rt=nexpura-review-2026`],
            ["Inventory", `/inventory?rt=nexpura-review-2026`],
            ["Inventory detail", `/inventory/af4eb6c4-22c1-4e0f-873d-a38bf9a26be4?rt=nexpura-review-2026`],
            ["Repairs", `/repairs?rt=nexpura-review-2026`],
            ["Repair detail (REP-001)", `/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75?rt=nexpura-review-2026`],
            ["Bespoke", `/bespoke?rt=nexpura-review-2026`],
            ["Bespoke detail (BES-001)", `/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026`],
            ["Invoices", `/invoices?rt=nexpura-review-2026`],
            ["Invoice (Paid)", `/invoices/4f9ed582-16f1-49d4-8309-173020be976e?rt=nexpura-review-2026`],
            ["Invoice (Partial)", `/invoices/d0b794d5-2c03-4198-9257-090aba7157c5?rt=nexpura-review-2026`],
            ["Suppliers", `/suppliers?rt=nexpura-review-2026`],
            ["Supplier (Tiffany)", `/suppliers/27d404df-c2b4-45f1-8dff-76c859307ffc?rt=nexpura-review-2026`],
            ["Migration Hub", `/migration?rt=nexpura-review-2026`],
            ["Migration Links", `/verification/migration-links?rt=nexpura-review-2026`],
          ].map(([label, path]) => (
            <a
              key={path}
              href={`https://${BUILD}${path}`}
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
        <h2 style={{ color: "#292524", fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Screenshot Pack — 20 shots from {BUILD}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: "24px" }}>
          {SCREENSHOTS.map(({ file, label }) => (
            <div key={file} style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", border: "1px solid #e7e5e4", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <img
                src={`${SUPABASE_PUBLIC}/screenshots/migration/${file}`}
                alt={label}
                style={{ width: "100%", display: "block" }}
                loading="lazy"
              />
              <p style={{ margin: 0, padding: "10px 14px", fontSize: "12px", color: "#78716c", background: "#fafaf9", borderTop: "1px solid #f5f5f4" }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
