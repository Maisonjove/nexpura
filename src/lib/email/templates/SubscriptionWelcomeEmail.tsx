import React from 'react'

export interface SubscriptionWelcomeEmailProps {
  businessName: string
  trialEndsAt: string
  dashboardUrl: string
}

export default function SubscriptionWelcomeEmail({
  businessName,
  trialEndsAt,
  dashboardUrl,
}: SubscriptionWelcomeEmailProps) {
  const trialDate = new Date(trialEndsAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Welcome to Nexpura — {businessName}</title>
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
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(248,245,240,0.6)' }}>Jewellery Business Management</p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <div style={{ display: 'inline-block', backgroundColor: '#52B788', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          🎉 Welcome Aboard
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '700', color: '#071A0D', fontFamily: 'Georgia, serif' }}>
                          Welcome to Nexpura, {businessName}!
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          Your account is ready. We're thrilled to have you — let's make running your jewellery business effortless.
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '20px 24px' }}>
                                <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Free Trial Ends</p>
                                <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: '700', color: '#071A0D' }}>{trialDate}</p>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4a5568' }}>No credit card required until then. Explore everything Nexpura has to offer.</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table cellPadding={0} cellSpacing={0} style={{ margin: '0 auto' }}>
                          <tbody>
                            <tr>
                              <td style={{ borderRadius: '8px', overflow: 'hidden' }}>
                                <a href={dashboardUrl} style={{ display: 'inline-block', backgroundColor: '#52B788', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', letterSpacing: '0.02em' }}>
                                  Go to your dashboard →
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
                          Sent via{' '}
                          <a href="https://nexpura.com" style={{ color: '#52B788', textDecoration: 'none', fontWeight: '600' }}>Nexpura</a>
                          {' · '}
                          <a href="https://nexpura.com" style={{ color: '#9CA3AF', textDecoration: 'none' }}>nexpura.com</a>
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
