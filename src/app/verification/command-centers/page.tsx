/**
 * /verification/command-centers — Direct route index for command center verification
 *
 * All links use ?rt=nexpura-review-2026 for authenticated routes (sandbox token).
 * Review routes require no auth token.
 * PREVIEW-ONLY. Remove after review cycle.
 */

import { headers } from "next/headers";

const REPAIR_ID = "09686ec7-0ec5-4950-ba7f-9982c9830d43";
const BESPOKE_ID = "ba62301b-0b26-423a-b02e-5a48bd7034b6";
const INVOICE_REPAIR_ID = "2c6672d1-884e-4d96-accf-b8a88ab2e27e";
const INVOICE_BESPOKE_ID = "b5b5b5b5-0005-0005-0005-000000000005";
const RT = "nexpura-review-2026";

const SECTIONS = [
  {
    title: "Real Authenticated App — Repair Command Center",
    description: "Full working command center. Line items, payments, email, print, stage advance. Uses sandbox token to inject demo auth without browser cookies.",
    routes: [
      {
        label: "Repair Command Center — R-0001 (David Moufarrej)",
        url: `/repairs/${REPAIR_ID}?rt=${RT}`,
        note: "Authenticated via ?rt= sandbox token",
      },
    ],
  },
  {
    title: "Real Authenticated App — Bespoke Command Center",
    description: "Full working command center for bespoke jobs. Same feature set as repair.",
    routes: [
      {
        label: "Bespoke Command Center — B-0001 (Sarah Chen)",
        url: `/bespoke/${BESPOKE_ID}?rt=${RT}`,
        note: "Authenticated via ?rt= sandbox token",
      },
    ],
  },
  {
    title: "Public Read-Only Review Routes",
    description: "No auth required. All command center panels visible in read-only mode. No edit, payment, upload, or action controls.",
    routes: [
      {
        label: "Review — Repair R-0001 (read-only)",
        url: `/review/repairs/${REPAIR_ID}`,
        note: "No auth required",
      },
      {
        label: "Review — Bespoke B-0001 (read-only)",
        url: `/review/bespoke/${BESPOKE_ID}`,
        note: "No auth required",
      },
    ],
  },
  {
    title: "Print Documents — Repair",
    description: "Separate print-optimised documents for repair jobs. Each is a distinct document type.",
    routes: [
      {
        label: "Print Repair Ticket — R-0001",
        url: `/print/repair/${REPAIR_ID}?rt=${RT}`,
        note: "Job summary + item detail for workshop",
      },
      {
        label: "Print Payment Receipt — Repair R-0001",
        url: `/print/receipt/repair/${REPAIR_ID}?rt=${RT}`,
        note: "Payments received, balance remaining, RCP-R-0001-N",
      },
      {
        label: "Print Invoice — INV-0001",
        url: `/print/invoice/${INVOICE_REPAIR_ID}?rt=${RT}`,
        note: "Formal invoice with line items, INV-0001",
      },
    ],
  },
  {
    title: "Print Documents — Bespoke",
    description: "Separate print-optimised documents for bespoke jobs.",
    routes: [
      {
        label: "Print Bespoke Job Sheet — B-0001",
        url: `/print/bespoke/${BESPOKE_ID}?rt=${RT}`,
        note: "Job specification + client details",
      },
      {
        label: "Print Payment Receipt — Bespoke B-0001",
        url: `/print/receipt/bespoke/${BESPOKE_ID}?rt=${RT}`,
        note: "Payments received, balance remaining",
      },
    ],
  },
  {
    title: "Proof Gallery",
    description: "Sequential Playwright-captured screenshots proving interaction reliability from this exact build.",
    routes: [
      {
        label: "Workflow Proof Gallery (screenshots + videos)",
        url: "/verification/workflows",
        note: "Repair CC and Bespoke CC interaction reliability proof",
      },
    ],
  },
];

export default async function CommandCenterIndexPage() {
  const hdrs = await headers();
  const BUILD = hdrs.get("host") || "nexpura";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Command Center Verification — {BUILD}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafaf9; color: #1c1917; line-height: 1.5; }
          .wrap { max-width: 860px; margin: 0 auto; padding: 48px 24px 80px; }
          .header { border-bottom: 1px solid #e7e5e4; padding-bottom: 24px; margin-bottom: 40px; }
          .badge { display: inline-block; background: #451a03; color: #fef3c7; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; margin-bottom: 12px; }
          h1 { font-size: 22px; font-weight: 700; color: #1c1917; margin-bottom: 6px; }
          .build-url { font-size: 12px; color: #78716c; font-family: monospace; background: #f5f5f4; padding: 4px 10px; border-radius: 4px; display: inline-block; margin-top: 8px; }
          .section { margin-bottom: 36px; }
          .section-title { font-size: 13px; font-weight: 700; color: #1c1917; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
          .section-desc { font-size: 13px; color: #78716c; margin-bottom: 14px; }
          .route-card { background: #fff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 14px 18px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
          .route-label { font-size: 14px; font-weight: 600; color: #1c1917; }
          .route-note { font-size: 11px; color: #a8a29e; margin-top: 2px; }
          .route-link { display: inline-flex; align-items: center; gap-6px; background: #b45309; color: #fff; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 7px; text-decoration: none; white-space: nowrap; transition: background 0.15s; }
          .route-link:hover { background: #92400e; }
          .route-link.secondary { background: #f5f5f4; color: #57534e; border: 1px solid #e7e5e4; }
          .route-link.secondary:hover { background: #e7e5e4; }
          .full-url { font-family: monospace; font-size: 10px; color: #a8a29e; margin-top: 4px; word-break: break-all; }
        `}</style>
      </head>
      <body>
        <div className="wrap">
          <div className="header">
            <div className="badge">Verification Index</div>
            <h1>Command Center — Direct Route Links</h1>
            <p style={{ fontSize: 13, color: "#78716c", marginTop: 6 }}>
              Every link on this page opens a real working route on this exact build.
              Authenticated routes use the <code style={{ background: "#f5f5f4", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>?rt=nexpura-review-2026</code> sandbox token.
              No browser login required for any link.
            </p>
            <div className="build-url">Build: https://{BUILD}</div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} className="section">
              <div className="section-title">{section.title}</div>
              <div className="section-desc">{section.description}</div>
              {section.routes.map((r) => (
                <div key={r.url} className="route-card">
                  <div style={{ flex: 1 }}>
                    <div className="route-label">{r.label}</div>
                    <div className="route-note">{r.note}</div>
                    <div className="full-url">https://{BUILD}{r.url}</div>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`route-link${r.url.startsWith("/verification") ? " secondary" : ""}`}
                  >
                    Open →
                  </a>
                </div>
              ))}
            </div>
          ))}
        </div>
      </body>
    </html>
  );
}
