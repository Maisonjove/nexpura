import React from 'react'

export interface AccountSuspendedEmailProps {
  businessName: string
  paymentUrl: string
}

export default function AccountSuspendedEmail({ businessName, paymentUrl }: AccountSuspendedEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Account suspended — Nexpura</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#F8F5F0', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', padding: '40px 20px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="600" cellPadding={0} cellSpacing={0} style={{ maxWidth: '600px', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ backgroundColor: '#374151', borderRadius: '12px 12px 0 0', padding: '32px 40px' }}>
                        <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#D1D5DB', letterSpacing: '0.05em', fontFamily: 'Georgia, serif' }}>nexpura</p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(209,213,219,0.6)' }}>{businessName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <div style={{ display: 'inline-block', backgroundColor: '#6B7280', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          Account Suspended
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '700', color: '#071A0D', fontFamily: 'Georgia, serif' }}>
                          Your account has been suspended
                        </p>
                        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          Hi {businessName}, your Nexpura account has been suspended due to non-payment. You can reactivate your account at any time by completing payment.
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '20px 24px' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#52B788', fontWeight: '600' }}>
                                  ✓ Your data is safe
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
                                  All your business data — customers, inventory, repairs, and invoices — will be kept for 90 days. Nothing will be deleted.
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table cellPadding={0} cellSpacing={0} style={{ margin: '0 auto' }}>
                          <tbody>
                            <tr>
                              <td>
                                <a href={paymentUrl} style={{ display: 'inline-block', backgroundColor: '#52B788', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                                  Reactivate your account →
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
