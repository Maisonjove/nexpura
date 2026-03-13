import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default async function EmbedAppointmentPage({ params }: Props) {
  const { tenantId } = await params;
  const admin = createAdminClient();
  const { data: tenant } = await admin.from("tenants").select("business_name, name").eq("id", tenantId).single();
  const businessName = tenant?.business_name || tenant?.name || "Jewellery Store";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Book Appointment — {businessName}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, sans-serif; background: white; padding: 24px; }
          h2 { font-size: 18px; font-weight: 600; color: #1c1917; margin-bottom: 6px; }
          p.sub { color: #78716c; font-size: 14px; margin-bottom: 24px; }
          label { display: block; font-size: 11px; font-weight: 600; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
          input, select, textarea { width: 100%; padding: 10px 14px; border: 1px solid #d6d3d1; border-radius: 8px; font-size: 14px; font-family: inherit; margin-bottom: 16px; }
          input:focus, select:focus, textarea:focus { outline: none; border-color: #8B7355; }
          button { width: 100%; padding: 12px; background: #1c1917; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
          button:hover { background: #292524; }
          .success { padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; text-align: center; color: #166534; }
        `}</style>
      </head>
      <body>
        <h2>📅 Book an Appointment</h2>
        <p className="sub">Choose a time that works for you and we&apos;ll confirm shortly.</p>
        <form id="appt-form">
          <label>Your Name *</label>
          <input type="text" name="name" required />
          <label>Email Address *</label>
          <input type="email" name="email" required />
          <label>Phone</label>
          <input type="tel" name="phone" />
          <label>Appointment Type *</label>
          <select name="appointment_type" required>
            <option value="">Select type…</option>
            <option value="Consultation">Consultation</option>
            <option value="Custom Design">Custom Design Discussion</option>
            <option value="Repair Drop-off">Repair Drop-off</option>
            <option value="Valuation">Valuation</option>
            <option value="Ring Sizing">Ring Sizing</option>
          </select>
          <label>Preferred Date *</label>
          <input type="date" name="preferred_date" required min={new Date().toISOString().split("T")[0]} />
          <label>Preferred Time</label>
          <select name="preferred_time">
            <option value="">Any time</option>
            <option value="Morning (9am–12pm)">Morning (9am–12pm)</option>
            <option value="Afternoon (12pm–3pm)">Afternoon (12pm–3pm)</option>
            <option value="Late Afternoon (3pm–6pm)">Late Afternoon (3pm–6pm)</option>
          </select>
          <label>Notes</label>
          <textarea name="notes" rows={3} placeholder="Any additional information..." />
          <button type="submit">Request Appointment →</button>
        </form>
        <div id="success-msg" style={{ display: 'none' }}>
          <div className="success">
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>✓</p>
            <p style={{ fontWeight: 600, marginBottom: '4px' }}>Appointment Request Sent!</p>
            <p style={{ fontSize: '14px' }}>We&apos;ll confirm your appointment shortly.</p>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          document.getElementById('appt-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const fd = new FormData(e.target);
            const data = {
              name: fd.get('name'),
              email: fd.get('email'),
              phone: fd.get('phone'),
              appointment_type: fd.get('appointment_type'),
              preferred_date: fd.get('preferred_date'),
              preferred_time: fd.get('preferred_time'),
              notes: fd.get('notes'),
            };
            try {
              await fetch('/api/shop/${tenantId}/appointment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
              document.getElementById('appt-form').style.display = 'none';
              document.getElementById('success-msg').style.display = 'block';
            } catch(err) {
              alert('Failed to submit. Please try again.');
            }
          });
        ` }} />
      </body>
    </html>
  );
}
