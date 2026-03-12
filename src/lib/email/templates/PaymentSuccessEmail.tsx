import React from 'react'

export interface PaymentSuccessEmailProps {
  businessName: string
  amount: number
  planName: string
  nextBillingDate: string
}

export default function PaymentSuccessEmail({ businessName, amount, planName, nextBillingDate }: PaymentSuccessEmailProps) {
  const nextDate = new Date(nextBillingDate).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Payment confirmed — Nexpura</title>
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
                        <div style={{ display: 'inline-block', backgroundColor: '#52B788', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          ✓ Payment Confirmed
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '700', color: '#071A0D', fontFamily: 'Georgia, serif' }}>
                          Payment confirmed ✓
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          Your <strong>{planName}</strong> subscription is active. Thank you, {businessName}!
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '20px 24px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Amount Charged</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: '700', color: '#071A0D' }}>${amount.toFixed(2)}</p>
                                      </td>
                                      <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Plan</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '600', color: '#071A0D', textTransform: 'capitalize' }}>{planName}</p>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td colSpan={2} style={{ borderTop: '1px solid #E8E8E8', paddingTop: '14px', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Next Billing Date</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#071A0D' }}>{nextDate}</p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', textAlign: 'center' }}>
                          Questions? Reply to this email or visit nexpura.com/support
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
