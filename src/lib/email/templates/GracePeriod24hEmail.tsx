import React from 'react'

export interface GracePeriod24hEmailProps {
  businessName: string
  paymentUrl: string
}

export default function GracePeriod24hEmail({ businessName, paymentUrl }: GracePeriod24hEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>24 hours remaining — Nexpura</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#F8F5F0', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', padding: '40px 20px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="600" cellPadding={0} cellSpacing={0} style={{ maxWidth: '600px', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ backgroundColor: '#7F1D1D', borderRadius: '12px 12px 0 0', padding: '32px 40px' }}>
                        <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#FCA5A5', letterSpacing: '0.05em', fontFamily: 'Georgia, serif' }}>nexpura</p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(252,165,165,0.7)' }}>{businessName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <div style={{ display: 'inline-block', backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          🚨 Urgent — 24 Hours Left
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '700', color: '#7F1D1D', fontFamily: 'Georgia, serif' }}>
                          24 hours remaining — pay now to avoid suspension
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          Hi {businessName}, your account will be suspended in <strong>24 hours</strong> if payment is not received. Act now to keep full access.
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#FEF2F2', border: '2px solid #EF4444', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '16px 20px' }}>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#DC2626' }}>
                                  ⏰ Deadline: Tomorrow at this time
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#EF4444' }}>
                                  After suspension, your data will be kept safe for 90 days.
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table cellPadding={0} cellSpacing={0} style={{ margin: '0 auto' }}>
                          <tbody>
                            <tr>
                              <td>
                                <a href={paymentUrl} style={{ display: 'inline-block', backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: '15px', fontWeight: '700', padding: '16px 40px', borderRadius: '8px', textDecoration: 'none', letterSpacing: '0.02em' }}>
                                  Pay now →
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
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
