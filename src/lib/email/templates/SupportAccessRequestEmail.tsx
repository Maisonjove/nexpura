import React from 'react'

export interface SupportAccessRequestEmailProps {
  businessName: string
  reason: string | null
  approveUrl: string
  denyUrl: string
}

export default function SupportAccessRequestEmail({
  businessName,
  reason,
  approveUrl,
  denyUrl,
}: SupportAccessRequestEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Nexpura Support Access Request</title>
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
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(248,245,240,0.6)' }}>Support Team</p>
                      </td>
                    </tr>
                    {/* Content */}
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <div style={{ display: 'inline-block', backgroundColor: '#F59E0B', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          🔐 Access Request
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '600', color: '#071A0D' }}>
                          Hi {businessName},
                        </p>
                        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          Our support team is requesting temporary access to your Nexpura dashboard to assist you.
                        </p>
                        {reason && (
                          <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', marginBottom: '24px' }}>
                            <tbody>
                              <tr>
                                <td style={{ padding: '16px 20px' }}>
                                  <p style={{ margin: 0, fontSize: '11px', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Reason for Access</p>
                                  <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#78350F' }}>{reason}</p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '16px 20px' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#4B5563', lineHeight: '1.6' }}>
                                  <strong>⏱ Access Duration:</strong> 24 hours (auto-expires)<br />
                                  <strong>🔒 Security:</strong> You can revoke access anytime from Settings
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {/* Buttons */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                          <tbody>
                            <tr>
                              <td align="center" style={{ paddingRight: '8px' }}>
                                <a href={approveUrl} style={{ display: 'inline-block', backgroundColor: '#10B981', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                                  ✓ Approve Access
                                </a>
                              </td>
                              <td align="center" style={{ paddingLeft: '8px' }}>
                                <a href={denyUrl} style={{ display: 'inline-block', backgroundColor: '#6B7280', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                                  ✗ Deny Request
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                          If you didn't expect this request, please ignore this email or contact us.
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
