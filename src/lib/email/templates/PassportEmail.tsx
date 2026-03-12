import React from 'react'

export interface PassportEmailProps {
  ownerName: string
  title: string
  passportUid: string
  jewelleryType: string | null
  issuedBy: string
  businessEmail: string | null
}

export default function PassportEmail({
  ownerName,
  title,
  passportUid,
  jewelleryType,
  issuedBy,
  businessEmail,
}: PassportEmailProps) {
  const passportUrl = `https://nexpura-delta.vercel.app/verify/${passportUid}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(passportUrl)}`
  const itemLabel = jewelleryType ? jewelleryType.replace(/_/g, ' ') : 'jewellery piece'

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Digital Jewellery Passport — {title}</title>
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
                      <td style={{ backgroundColor: '#071A0D', borderRadius: '12px 12px 0 0', padding: '32px 40px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: '#52B788', letterSpacing: '0.06em', fontFamily: 'Georgia, serif' }}>
                          nexpura
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(248,245,240,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          Digital Jewellery Passport
                        </p>
                      </td>
                    </tr>

                    {/* Body */}
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '16px', color: '#071A0D', fontWeight: '600' }}>
                          Hi {ownerName},
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
                          Your <strong>{itemLabel}</strong> has been registered with a Digital Jewellery Passport. This permanent record authenticates your piece and travels with it forever.
                        </p>

                        {/* Passport card */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#071A0D', borderRadius: '12px', marginBottom: '32px', overflow: 'hidden' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '28px 28px 24px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ verticalAlign: 'top' }}>
                                        <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'rgba(82,183,136,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600' }}>
                                          Digital Passport
                                        </p>
                                        <p style={{ margin: '0 0 4px', fontSize: '20px', color: '#F8F5F0', fontWeight: '700', fontFamily: 'Georgia, serif' }}>
                                          {title}
                                        </p>
                                        {jewelleryType && (
                                          <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(248,245,240,0.5)', textTransform: 'capitalize' }}>
                                            {itemLabel}
                                          </p>
                                        )}
                                        <table cellPadding={0} cellSpacing={0}>
                                          <tbody>
                                            <tr>
                                              <td style={{ paddingRight: '32px', paddingBottom: '12px', verticalAlign: 'top' }}>
                                                <p style={{ margin: 0, fontSize: '10px', color: 'rgba(248,245,240,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600' }}>Passport ID</p>
                                                <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#52B788', fontWeight: '700', fontFamily: 'monospace' }}>{passportUid}</p>
                                              </td>
                                              <td style={{ verticalAlign: 'top' }}>
                                                <p style={{ margin: 0, fontSize: '10px', color: 'rgba(248,245,240,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600' }}>Issued By</p>
                                                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#F8F5F0', fontWeight: '500' }}>{issuedBy}</p>
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </td>
                                      <td style={{ verticalAlign: 'top', paddingLeft: '20px', textAlign: 'center', width: '100px' }}>
                                        {/* QR Code */}
                                        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', display: 'inline-block' }}>
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={qrUrl}
                                            alt={`QR Code for ${passportUid}`}
                                            width={80}
                                            height={80}
                                            style={{ display: 'block' }}
                                          />
                                        </div>
                                        <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'rgba(248,245,240,0.3)' }}>Scan to verify</p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* CTA button */}
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
                                    padding: '14px 36px',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  View Your Passport
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6B7280', textAlign: 'center', lineHeight: '1.6' }}>
                          Scan the QR code on your certificate to verify this piece at any time.
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', textAlign: 'center', lineHeight: '1.6' }}>
                          Keep this email safe — it contains the link to your permanent jewellery record.
                        </p>

                        {businessEmail && (
                          <p style={{ margin: '24px 0 0', fontSize: '13px', color: '#6B7280', textAlign: 'center', lineHeight: '1.6' }}>
                            Questions? Contact us at{' '}
                            <a href={`mailto:${businessEmail}`} style={{ color: '#52B788', textDecoration: 'none' }}>
                              {businessEmail}
                            </a>
                          </p>
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
                          This passport was registered by {issuedBy} using Nexpura.
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
