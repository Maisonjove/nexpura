/**
 * /verification/command-centers — Direct route index for command center verification
 * PREVIEW-ONLY. Remove after review cycle.
 */

import { headers } from "next/headers";

const REPAIR_ID = "09686ec7-0ec5-4950-ba7f-9982c9830d43";
const BESPOKE_ID = "ba62301b-0b26-423a-b02e-5a48bd7034b6";
const INVOICE_REPAIR_ID = "2c6672d1-884e-4d96-accf-b8a88ab2e27e";
const RT = "nexpura-review-2026";

const SECTIONS = [
  {
    title: "Real Authenticated App",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    routes: [
      {
        label: "Repair Command Center — R-0001 (David Moufarrej)",
        url: `/repairs/${REPAIR_ID}?rt=${RT}`,
        note: "Full command center: line items, payments, email, print, stage. Auth injected via ?rt= token.",
        tag: "AUTHENTICATED",
      },
      {
        label: "Bespoke Command Center — B-0001",
        url: `/bespoke/${BESPOKE_ID}?rt=${RT}`,
        note: "Full command center for bespoke jobs. Same feature set. Auth injected via ?rt= token.",
        tag: "AUTHENTICATED",
      },
    ],
  },
  {
    title: "Public Read-Only Review",
    color: "#059669",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    routes: [
      {
        label: "Review Repair — R-0001 (read-only)",
        url: `/review/repairs/${REPAIR_ID}`,
        note: "No auth required. All panels visible. No edit, payment, upload, or action controls.",
        tag: "NO AUTH",
      },
      {
        label: "Review Bespoke — B-0001 (read-only)",
        url: `/review/bespoke/${BESPOKE_ID}`,
        note: "No auth required. Full read-only view.",
        tag: "NO AUTH",
      },
    ],
  },
  {
    title: "Print Documents — Repair",
    color: "#1c1917",
    bg: "#fafaf9",
    border: "#e7e5e4",
    routes: [
      {
        label: "Repair Ticket — R-0001",
        url: `/print/repair/${REPAIR_ID}?rt=${RT}`,
        note: "Job summary + item detail for workshop",
        tag: "PRINT",
      },
      {
        label: "Payment Receipt — Repair R-0001",
        url: `/print/receipt/repair/${REPAIR_ID}?rt=${RT}`,
        note: "Payments received, balance remaining — RCP-R-0001-N (distinct from invoice)",
        tag: "PRINT",
      },
      {
        label: "Invoice — INV-0001",
        url: `/print/invoice/${INVOICE_REPAIR_ID}?rt=${RT}`,
        note: "Formal invoice with line items (distinct from receipt)",
        tag: "PRINT",
      },
    ],
  },
  {
    title: "Print Documents — Bespoke",
    color: "#1c1917",
    bg: "#fafaf9",
    border: "#e7e5e4",
    routes: [
      {
        label: "Bespoke Job Sheet — B-0001",
        url: `/print/bespoke/${BESPOKE_ID}?rt=${RT}`,
        note: "Job specification + client details",
        tag: "PRINT",
      },
      {
        label: "Payment Receipt — Bespoke B-0001",
        url: `/print/receipt/bespoke/${BESPOKE_ID}?rt=${RT}`,
        note: "Payments received, balance remaining",
        tag: "PRINT",
      },
    ],
  },
  {
    title: "Proof Gallery",
    color: "#7c3aed",
    bg: "#faf5ff",
    border: "#e9d5ff",
    routes: [
      {
        label: "Workflow Proof Gallery (screenshots + videos)",
        url: "/verification/workflows",
        note: "Sequential Playwright screenshots proving interaction reliability",
        tag: "GALLERY",
      },
    ],
  },
];

export default async function CommandCenterIndexPage() {
  const hdrs = await headers();
  const BUILD = hdrs.get("host") || "nexpura";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#fafaf9", minHeight: "100vh", padding: "48px 24px 80px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 40, borderLeft: "4px solid #b45309", paddingLeft: 16 }}>
          <span style={{ display: "inline-block", background: "#451a03", color: "#fef3c7", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "3px 8px", borderRadius: 4, marginBottom: 10 }}>
            Verification Index
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1c1917", margin: "0 0 6px" }}>
            Command Center — Direct Route Links
          </h1>
          <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>
            Every link below opens a real working route on this exact build. Authenticated routes use the{" "}
            <code style={{ background: "#f5f5f4", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>?rt=nexpura-review-2026</code>{" "}
            sandbox token. No browser login required.
          </p>
          <div style={{ marginTop: 10, display: "inline-block", background: "#f5f5f4", padding: "4px 10px", borderRadius: 4, fontFamily: "monospace", fontSize: 12, color: "#78716c" }}>
            Build: https://{BUILD}
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: section.color, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>
              {section.title}
            </div>
            {section.routes.map((r) => (
              <div
                key={r.url}
                style={{
                  background: section.bg,
                  border: `1px solid ${section.border}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1c1917" }}>{r.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, background: section.color, color: "#fff", padding: "1px 6px", borderRadius: 3, letterSpacing: "0.06em" }}>
                      {r.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#78716c", marginBottom: 3 }}>{r.note}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#a8a29e", wordBreak: "break-all" as const }}>
                    https://{BUILD}{r.url}
                  </div>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    background: section.color,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "8px 16px",
                    borderRadius: 7,
                    textDecoration: "none",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  Open →
                </a>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #e7e5e4", display: "flex", gap: 20, flexWrap: "wrap" as const }}>
          <a href="/verification/workflows" style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}>Proof Gallery →</a>
          <a href={`/sandbox/links?rt=${RT}`} style={{ fontSize: 13, color: "#78716c" }}>Full route index</a>
        </div>
      </div>
    </div>
  );
}
