import React from 'react'

export interface UserInvitedEmailProps {
  inviteeName: string
  businessName: string
  inviterName: string
  role: string
  acceptUrl: string
}

export default function UserInvitedEmail({ inviteeName, businessName, inviterName, role, acceptUrl }: UserInvitedEmailProps) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>You've been invited to join {businessName} on Nexpura</title>
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
                        <div style={{ display: 'inline-block', backgroundColor: '#8B5CF6', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          ✉ Team Invitation
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '600', color: '#071A0D' }}>
                          Hi {inviteeName},
                        </p>
                        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          <strong>{inviterName}</strong> has invited you to join <strong>{businessName}</strong> on Nexpura — jewellery business management.
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '16px 20px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ width: '50%' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Business</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: '600', color: '#071A0D' }}>{businessName}</p>
                                      </td>
                                      <td style={{ width: '50%' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Your Role</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: '600', color: '#071A0D' }}>{roleLabel}</p>
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
                                <a href={acceptUrl} style={{ display: 'inline-block', backgroundColor: '#8B5CF6', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                                  Accept invitation →
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                          This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
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
