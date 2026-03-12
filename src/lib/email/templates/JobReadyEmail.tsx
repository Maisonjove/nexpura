import React from 'react'

export interface JobReadyEmailProps {
  customerName: string
  jobTitle: string
  jewelleryType: string | null
  jobNumber: string
  itemDescription: string | null
  businessName: string
  businessEmail: string | null
  businessPhone: string | null
  businessAddress: string | null
  passportUid: string | null
}

export default function JobReadyEmail({
  customerName,
  jobTitle,
  jewelleryType,
  jobNumber,
  itemDescription,
  businessName,
  businessEmail,
  businessPhone,
  businessAddress,
  passportUid,
}: JobReadyEmailProps) {
  const itemLabel = jewelleryType ? jewelleryType.replace(/_/g, ' ') : 'jewellery piece'
  const passportUrl = passportUid
    ? `https://nexpura-delta.vercel.app/verify/${passportUid}`
    : null

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your {itemLabel} is ready — {businessName}</title>
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
                        <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#52B788', letterSpacing: '0.05em', fontFamily: 'Georgia, serif' }}>
                          nexpura
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(248,245,240,0.6)', letterSpacing: '0.03em' }}>
                          {businessName}
                        </p>
                      </td>
                    </tr>

                    {/* Body */}
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        {/* Ready badge */}
                        <div style={{ display: 'inline-block', backgroundColor: '#52B788', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          ✓ Ready for Collection
                        </div>

                        <p style={{ margin: '0 0 8px', fontSize: '16px', color: '#071A0D', fontWeight: '600' }}>
                          Hi {customerName},
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
                          Great news! Your <strong>{jobTitle}</strong> is ready for collection.
                        </p>

                        {/* Details box */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', borderRadius: '8px', marginBottom: '24px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '20px 24px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Job Reference</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '700', fontFamily: 'monospace' }}>{jobNumber}</p>
                                      </td>
                                      <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Item Type</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '600', textTransform: 'capitalize' }}>{itemLabel}</p>
                                      </td>
                                    </tr>
                                    {itemDescription && (
                                      <tr>
                                        <td colSpan={2} style={{ paddingBottom: '14px', verticalAlign: 'top' }}>
                                          <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Description</p>
                                          <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D' }}>{itemDescription}</p>
                                        </td>
                                      </tr>
                                    )}
                                    {(businessAddress || businessPhone || businessEmail) && (
                                      <tr>
                                        <td colSpan={2} style={{ borderTop: '1px solid #E8E8E8', paddingTop: '14px', verticalAlign: 'top' }}>
                                          <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Contact</p>
                                          {businessAddress && <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#4a5568' }}>{businessAddress}</p>}
                                          {businessPhone && <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#4a5568' }}>{businessPhone}</p>}
                                          {businessEmail && (
                                            <p style={{ margin: '2px 0 0', fontSize: '13px' }}>
                                              <a href={`mailto:${businessEmail}`} style={{ color: '#52B788', textDecoration: 'none' }}>{businessEmail}</a>
                                            </p>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
                          Please contact us to arrange a convenient pickup time. We look forward to seeing you.
                        </p>

                        {passportUrl && (
                          <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '32px' }}>
                            <tbody>
                              <tr>
                                <td align="center">
                                  <a
                                    href={passportUrl}
                                    style={{
                                      display: 'inline-block',
                                      backgroundColor: '#52B788',
                                      color: '#FFFFFF',
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      padding: '14px 32px',
                                      borderRadius: '8px',
                                      textDecoration: 'none',
                                      letterSpacing: '0.02em',
                                    }}
                                  >
                                    View Digital Passport
                                  </a>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={{ backgroundColor: '#F8F5F0', borderRadius: '0 0 12px 12px', padding: '24px 40px', borderTop: '1px solid #E8E8E8' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                          Sent via{' '}
                          <a href="https://nexpura.com" style={{ color: '#52B788', textDecoration: 'none', fontWeight: '600' }}>
                            Nexpura
                          </a>
                          {' · '}
                          <a href="https://nexpura.com" style={{ color: '#9CA3AF', textDecoration: 'none' }}>
                            nexpura.com
                          </a>
                        </p>
                        <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#C4C4C4', textAlign: 'center' }}>
                          This notification was sent on behalf of {businessName}.
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
