import React from 'react'

export interface FreeToPaidConversionEmailProps {
  businessName: string
  paymentUrl: string
  deadline: string
}

export default function FreeToPaidConversionEmail({ businessName, paymentUrl, deadline }: FreeToPaidConversionEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Payment required — Nexpura</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#F8F5F0', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', padding: '40px 20px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="600" cellPadding={0} cellSpacing={0} style={{ maxWidth: '600px', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ backgroundColor: 'amber-700', borderRadius: '12px 12px 0 0', padding: '32px 40px' }}>
                        <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#fff', letterSpacing: '0.05em', fontFamily: 'Georgia, serif' }}>nexpura</p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <p style={{ margin: '0 0 16px', fontSize: '22px', fontWeight: '700', color: '#071A0D', fontFamily: 'Georgia, serif' }}>
                          Payment required for your account
                        </p>
                        <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          Hi {businessName}, your free access period is ending. To keep access to Nexpura, please add a payment method within 48 hours.
                        </p>
                        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          <strong>Deadline:</strong> {deadline}
                        </p>
                        <a href={paymentUrl} style={{ display: 'inline-block', backgroundColor: 'amber-700', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                          Add payment method →
                        </a>
                        <p style={{ margin: '24px 0 0', fontSize: '13px', color: '#6B7280' }}>
                          If you don&apos;t add payment by the deadline, your account will be suspended. Your data will be kept for 90 days.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#F8F5F0', borderRadius: '0 0 12px 12px', padding: '24px 40px', borderTop: '1px solid #E8E8E8' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>Nexpura — Jewellery Management Platform</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
