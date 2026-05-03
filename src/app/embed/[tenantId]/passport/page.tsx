import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * /embed/[tenantId]/passport — iframe-embeddable passport verifier. CC-ready.
 *
 * Same pattern as the other embed pages: sync wrapper → Suspense → async body.
 * Renders a standalone <html> document. Loader is pure w.r.t. tenantId.
 */

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default function EmbedPassportPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <PassportBody paramsPromise={params} />
    </Suspense>
  );
}

async function PassportBody({ paramsPromise }: { paramsPromise: Promise<{ tenantId: string }> }) {
  const { tenantId } = await paramsPromise;
  const businessName = await loadBusinessName(tenantId);
  // Consistent with /embed/[tenantId] (catalogue) — don't render the
  // passport verifier for a non-existent tenant.
  if (businessName === null) notFound();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Passport Verification — {businessName}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, sans-serif; background: #fafaf9; padding: 24px; }
          h2 { font-size: 18px; font-weight: 600; color: #1c1917; margin-bottom: 8px; }
          p { color: #78716c; font-size: 14px; margin-bottom: 20px; }
          .form { display: flex; gap: 8px; margin-bottom: 20px; }
          input { flex: 1; padding: 10px 14px; border: 1px solid #d6d3d1; border-radius: 8px; font-size: 14px; font-family: monospace; }
          input:focus { outline: none; border-color: amber-700; box-shadow: 0 0 0 3px rgba(139,115,85,0.2); }
          button { padding: 10px 20px; background: amber-700; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
          button:hover { background: #7a6349; }
          .result { background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; }
          .uid { font-family: monospace; font-size: 12px; background: #f5f5f4; padding: 4px 8px; border-radius: 4px; color: amber-700; }
          .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
          .badge-active { background: #f0fdf4; color: #166534; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f4; font-size: 14px; }
          .row:last-child { border-bottom: none; }
          .label { color: #a8a29e; }
          .value { color: #1c1917; font-weight: 500; }
          .error { padding: 12px 16px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; color: #be123c; font-size: 14px; }
        `}</style>
      </head>
      <body>
        <h2>🛡️ Passport Verification</h2>
        <p>Enter a passport number to verify your jewellery&apos;s authenticity.</p>
        <div className="form">
          <input type="text" id="uid-input" placeholder="e.g. NX-ABCD-1234" />
          <button type="button" id="lookup-btn">Verify</button>
        </div>
        <div id="result"></div>
        <script dangerouslySetInnerHTML={{ __html: `
          document.getElementById('lookup-btn').addEventListener('click', lookup);
          async function lookup() {
            const uid = document.getElementById('uid-input').value.trim();
            if (!uid) return;
            const res = document.getElementById('result');
            res.innerHTML = '<p style="color:#78716c">Looking up...</p>';
            try {
              const r = await fetch('/api/passport/lookup?uid=' + encodeURIComponent(uid) + '&tenant=${tenantId}');
              const d = await r.json();
              if (d.error || !d.passport) {
                res.innerHTML = '<div class="error">Passport not found. Please check the ID and try again.</div>';
              } else {
                // Joey 2026-05-03 P2-B audit: pre-fix this template
                // built innerHTML from tenant-controlled fields
                // (title, jewellery_type, current_owner_name) — stored
                // XSS if any field contained HTML. Now build via DOM
                // APIs so each field is treated as text. Static
                // attributes (passport_uid in href) are scrubbed via
                // encodeURIComponent.
                const p = d.passport;
                res.innerHTML = '';
                const wrap = document.createElement('div'); wrap.className = 'result';
                const head = document.createElement('div');
                head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px';
                const uid = document.createElement('span'); uid.className = 'uid'; uid.textContent = p.passport_uid;
                const badge = document.createElement('span'); badge.className = 'badge badge-active'; badge.textContent = '✓ Authentic';
                head.appendChild(uid); head.appendChild(badge);
                wrap.appendChild(head);
                function row(label, val) {
                  const r = document.createElement('div'); r.className = 'row';
                  const l = document.createElement('span'); l.className = 'label'; l.textContent = label;
                  const v = document.createElement('span'); v.className = 'value'; v.textContent = val ?? '—';
                  r.appendChild(l); r.appendChild(v);
                  return r;
                }
                wrap.appendChild(row('Item', p.title));
                wrap.appendChild(row('Type', p.jewellery_type || '—'));
                wrap.appendChild(row('Owner', p.current_owner_name || '—'));
                wrap.appendChild(row('Issued', new Date(p.created_at).toLocaleDateString('en-AU')));
                const linkWrap = document.createElement('div'); linkWrap.style.cssText = 'margin-top:16px;text-align:center';
                const link = document.createElement('a');
                link.href = '/verify/' + encodeURIComponent(p.passport_uid);
                link.target = '_blank';
                link.style.cssText = 'color:#92400e;font-size:13px;text-decoration:none';
                link.textContent = 'View full passport →';
                linkWrap.appendChild(link);
                wrap.appendChild(linkWrap);
                res.appendChild(wrap);
              }
            } catch(e) {
              res.innerHTML = '<div class="error">An error occurred. Please try again.</div>';
            }
          }
          document.getElementById('uid-input').addEventListener('keydown', e => { if (e.key === 'Enter') lookup(); });
        ` }} />
      </body>
    </html>
  );
}

// Joey 2026-05-03 P2-B audit: filter out soft-deleted tenants. Pre-fix
// soft-deleted tenants rendered a working passport widget pointing at
// a tenant that no longer exists.
async function loadBusinessName(tenantId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name, name")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tenant) return null;
  return (tenant.business_name as string | null) || (tenant.name as string | null) || "Jewellery Store";
}
