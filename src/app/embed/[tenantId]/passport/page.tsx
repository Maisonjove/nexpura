import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default async function EmbedPassportPage({ params }: Props) {
  const { tenantId } = await params;
  const admin = createAdminClient();
  const { data: tenant } = await admin.from("tenants").select("business_name, name").eq("id", tenantId).single();
  const businessName = tenant?.business_name || tenant?.name || "Jewellery Store";

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
          input:focus { outline: none; border-color: #8B7355; box-shadow: 0 0 0 3px rgba(139,115,85,0.2); }
          button { padding: 10px 20px; background: #8B7355; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
          button:hover { background: #7a6349; }
          .result { background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; }
          .uid { font-family: monospace; font-size: 12px; background: #f5f5f4; padding: 4px 8px; border-radius: 4px; color: #8B7355; }
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
                const p = d.passport;
                res.innerHTML = \`<div class="result">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <span class="uid">\${p.passport_uid}</span>
                    <span class="badge badge-active">✓ Authentic</span>
                  </div>
                  <div class="row"><span class="label">Item</span><span class="value">\${p.title}</span></div>
                  <div class="row"><span class="label">Type</span><span class="value">\${p.jewellery_type || '—'}</span></div>
                  <div class="row"><span class="label">Owner</span><span class="value">\${p.current_owner_name || '—'}</span></div>
                  <div class="row"><span class="label">Issued</span><span class="value">\${new Date(p.created_at).toLocaleDateString('en-AU')}</span></div>
                  <div style="margin-top:16px;text-align:center">
                    <a href="/verify/\${p.passport_uid}" target="_blank" style="color:#8B7355;font-size:13px;text-decoration:none">View full passport →</a>
                  </div>
                </div>\`;
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
