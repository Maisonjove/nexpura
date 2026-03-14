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
          body { font-family: -apple-system, sans-serif; background: transparent; padding: 24px; color: #1c1917; }
          .container { max-width: 500px; margin: 0 auto; background: white; border: 1px solid #e7e5e4; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          h2 { font-size: 20px; font-weight: 700; color: #1c1917; margin-bottom: 8px; font-family: Georgia, serif; }
          p.sub { color: #78716c; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
          label { display: block; font-size: 10px; font-weight: 700; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
          input, select, textarea { width: 100%; padding: 12px 16px; border: 1px solid #e7e5e4; border-radius: 10px; font-size: 14px; font-family: inherit; margin-bottom: 20px; transition: all 0.2s; background: #fafaf9; }
          input:focus, select:focus, textarea:focus { outline: none; border-color: #8B7355; background: white; box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.1); }
          button { width: 100%; padding: 14px; background: #1c1917; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; letter-spacing: 0.02em; }
          button:hover { background: #8B7355; transform: translateY(-1px); }
          button:active { transform: translateY(0); }
          .success { padding: 40px 20px; text-align: center; color: #1c1917; }
          .success-icon { width: 64px; height: 64px; background: #f5f5f4; color: #8B7355; border-radius: 50%; display: flex; items-center; justify-center; margin: 0 auto 24px; font-size: 32px; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <h2>Request an Appointment</h2>
          <p className="sub">Experience our bespoke service. Choose a preferred time and we&apos;ll be in touch to confirm.</p>
          <form id="appt-form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label>Your Name *</label>
                <input type="text" name="name" required placeholder="John Doe" />
              </div>
              <div>
                <label>Email Address *</label>
                <input type="email" name="email" required placeholder="john@example.com" />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label>Phone</label>
                <input type="tel" name="phone" placeholder="+61 400 000 000" />
              </div>
              <div>
                <label>Service *</label>
                <select name="appointment_type" required>
                  <option value="">Select service…</option>
                  <option value="Consultation">Private Consultation</option>
                  <option value="Custom Design">Custom Design Discussion</option>
                  <option value="Repair Drop-off">Repair & Cleaning</option>
                  <option value="Valuation">Professional Valuation</option>
                  <option value="Ring Sizing">Ring Sizing Service</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label>Preferred Date *</label>
                <input type="date" name="preferred_date" required min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <label>Preferred Time</label>
                <select name="preferred_time">
                  <option value="">Any time</option>
                  <option value="Morning (9am–12pm)">Morning</option>
                  <option value="Afternoon (12pm–3pm)">Afternoon</option>
                  <option value="Late Afternoon (3pm–6pm)">Late Afternoon</option>
                </select>
              </div>
            </div>

            <label>Notes & Requests</label>
            <textarea name="notes" rows={3} placeholder="Please share any specific details about your enquiry..." />
            <button type="submit">Submit Request</button>
          </form>
          <div id="success-msg" style={{ display: 'none' }}>
            <div className="success">
              <div className="success-icon">✓</div>
              <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px', fontFamily: 'Georgia, serif' }}>Request Received</p>
              <p style={{ fontSize: '14px', color: '#78716c' }}>Thank you. A member of our team will contact you shortly to confirm your appointment.</p>
            </div>
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
