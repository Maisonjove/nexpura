import React from 'react'

export interface SupportAccessApprovedEmailProps {
  businessName: string
  expiresAt: string
  dashboardUrl: string
}

export default function SupportAccessApprovedEmail({
  businessName,
  expiresAt,
  dashboardUrl,
}: SupportAccessApprovedEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Support Access Approved — {businessName}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#F8F5F0', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', padding: '40px 20px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="600" cellPadding={0} cellSpacing={0} style={{ maxWidth: '600px', width: '100%' }}>
                  <tbody>
                    {/* Header */}
                    <tr>
                      <td style={{ backgroundColor: '#071A0D', borderRadius: '12px 12px 0 0', padding: '32px 40px' }}>
                        <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#52B788', letterSpacing: '0.05em', fontFamily: 'Georgia, serif' }}>nexpura</p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(248,245,240,0.6)' }}>Admin Notification</p>
                      </td>
                    </tr>
                    {/* Content */}
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <div style={{ display: 'inline-block', backgroundColor: '#10B981', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          ✓ Access Approved
                        </div>
                        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          <strong>{businessName}</strong> has approved your support access request.
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '16px 20px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ width: '50%' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Business</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: '600', color: '#071A0D' }}>{businessName}</p>
                                      </td>
                                      <td style={{ width: '50%' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Access Expires</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: '600', color: '#071A0D' }}>{expiresAt}</p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table cellPadding={0} cellSpacing={0} style={{ margin: '0 auto 24px' }}>
                          <tbody>
                            <tr>
                              <td>
                                <a href={dashboardUrl} style={{ display: 'inline-block', backgroundColor: '#52B788', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                                  Enter Dashboard →
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                          Access will automatically expire after 24 hours.
                        </p>
                      </td>
                    </tr>
                    {/* Footer */}
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
