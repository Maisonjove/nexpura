import React from 'react'

export interface GracePeriodStartedEmailProps {
  businessName: string
  hoursRemaining: number
  paymentUrl: string
  deadline: string
}

export default function GracePeriodStartedEmail({ businessName, hoursRemaining, paymentUrl, deadline }: GracePeriodStartedEmailProps) {
  const deadlineDate = new Date(deadline).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
                      <td style={{ backgroundColor: '#071A0D', borderRadius: '12px 12px 0 0', padding: '32px 40px' }}>
                        <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#52B788', letterSpacing: '0.05em', fontFamily: 'Georgia, serif' }}>nexpura</p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(248,245,240,0.6)' }}>{businessName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <div style={{ display: 'inline-block', backgroundColor: '#F59E0B', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          ⚠️ Action Required
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#071A0D', fontFamily: 'Georgia, serif', lineHeight: '1.4' }}>
                          Payment required — your account will be suspended in {hoursRemaining} hours
                        </p>
                        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          Hi {businessName}, we were unable to process your latest payment. To keep your account active, please pay before the deadline below.
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#FFFBEB', border: '2px solid #F59E0B', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '16px 20px' }}>
                                <p style={{ margin: 0, fontSize: '11px', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Suspension Deadline</p>
                                <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '700', color: '#92400E' }}>{deadlineDate}</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table cellPadding={0} cellSpacing={0} style={{ margin: '0 auto 24px' }}>
                          <tbody>
                            <tr>
                              <td>
                                <a href={paymentUrl} style={{ display: 'inline-block', backgroundColor: '#F59E0B', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                                  Pay now to keep your account active →
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: 0, fontSize: '13px', color: '#52B788', textAlign: 'center', fontWeight: '500' }}>
                          ✓ Your data will be preserved — we won't delete anything
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#F8F5F0', borderRadius: '0 0 12px 12px', padding: '24px 40px', borderTop: '1px solid #E8E8E8' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                          Sent via <a href="https://nexpura.com" style={{ color: '#52B788', textDecoration: 'none', fontWeight: '600' }}>Nexpura</a>
                        </p>
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
