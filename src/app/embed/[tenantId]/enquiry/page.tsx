import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default async function EmbedEnquiryPage({ params }: Props) {
  const { tenantId } = await params;
  const admin = createAdminClient();
  const { data: tenant } = await admin.from("tenants").select("business_name, name").eq("id", tenantId).single();
  const businessName = tenant?.business_name || tenant?.name || "Jewellery Store";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Enquiry — {businessName}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, sans-serif; background: white; padding: 24px; }
          h2 { font-size: 18px; font-weight: 600; color: #1c1917; margin-bottom: 6px; }
          p.sub { color: #78716c; font-size: 14px; margin-bottom: 24px; }
          label { display: block; font-size: 11px; font-weight: 600; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
          input, select, textarea { width: 100%; padding: 10px 14px; border: 1px solid #d6d3d1; border-radius: 8px; font-size: 14px; font-family: inherit; margin-bottom: 16px; }
          input:focus, select:focus, textarea:focus { outline: none; border-color: amber-700; }
          button { width: 100%; padding: 12px; background: amber-700; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
          button:hover { background: #7a6349; }
          .success { padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; text-align: center; color: #166534; }
        `}</style>
      </head>
      <body>
        <h2>Send an Enquiry</h2>
        <p className="sub">We&apos;ll get back to you as soon as possible.</p>
        <form id="enquiry-form">
          <label>Your Name *</label>
          <input type="text" name="name" required />
          <label>Email Address *</label>
          <input type="email" name="email" required />
          <label>Phone</label>
          <input type="tel" name="phone" />
          <label>Enquiry Type</label>
          <select name="type">
            <option value="general">General Enquiry</option>
            <option value="custom">Custom Design</option>
            <option value="repair">Repair</option>
            <option value="valuation">Valuation</option>
          </select>
          <label>Message *</label>
          <textarea name="message" rows={4} required placeholder="Tell us about your enquiry..." />
          <button type="submit">Send Enquiry →</button>
        </form>
        <div id="error-msg" style={{ display: 'none', color: '#dc2626', padding: '12px', marginTop: '8px', background: '#fef2f2', borderRadius: '6px' }}>Failed to send enquiry. Please try again.</div>
        <div id="success-msg" style={{ display: 'none' }}>
          <div className="success">
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>✓</p>
            <p style={{ fontWeight: 600, marginBottom: '4px' }}>Enquiry Sent!</p>
            <p style={{ fontSize: '14px', color: '#166534' }}>We&apos;ll be in touch shortly.</p>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          document.getElementById('enquiry-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const fd = new FormData(e.target);
            const data = {
              name: fd.get('name'),
              email: fd.get('email'),
              phone: fd.get('phone'),
              enquiry_type: fd.get('type'),
              message: fd.get('message'),
            };
            try {
              await fetch('/api/shop/${tenantId}/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
              document.getElementById('enquiry-form').style.display = 'none';
              document.getElementById('success-msg').style.display = 'block';
            } catch(err) {
              const errEl = document.getElementById('error-msg'); if (errEl) errEl.style.display = 'block';
            }
          });
        ` }} />
      </body>
    </html>
  );
}
