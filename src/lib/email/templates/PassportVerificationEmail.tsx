import * as React from 'react'

export interface PassportVerificationEmailProps {
  ownerName: string
  itemName: string
  passportUid: string
  verificationUrl: string
  issuedBy: string
  businessEmail?: string | null
  qrCodeUrl?: string | null
}

export default function PassportVerificationEmail({
  ownerName,
  itemName,
  passportUid,
  verificationUrl,
  issuedBy,
  businessEmail,
}: PassportVerificationEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Your Jewellery is Certified Authentic</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#fafaf9', fontFamily: "'Georgia', serif" }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#fafaf9', padding: '40px 20px' }}>
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style={{ maxWidth: '540px', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                {/* Header */}
                <tr>
                  <td style={{ backgroundColor: '#1a1a1a', padding: '40px 40px 32px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'amber-700', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: 'sans-serif', fontWeight: 600 }}>
                      Jewellery Passport
                    </p>
                    <h1 style={{ margin: '12px 0 0', color: '#ffffff', fontSize: '26px', fontWeight: 400, letterSpacing: '1px' }}>
                      Certified Authentic
                    </h1>
                  </td>
                </tr>

                {/* Shield icon */}
                <tr>
                  <td style={{ padding: '40px 40px 0', textAlign: 'center' }}>
                    <div style={{ display: 'inline-block', width: '72px', height: '72px', backgroundColor: '#f5f0ea', borderRadius: '50%', lineHeight: '72px', fontSize: '32px' }}>
                      🛡️
                    </div>
                  </td>
                </tr>

                {/* Body */}
                <tr>
                  <td style={{ padding: '32px 40px' }}>
                    <p style={{ margin: '0 0 8px', color: '#57534e', fontSize: '15px', fontFamily: 'sans-serif' }}>
                      Dear {ownerName},
                    </p>
                    <p style={{ margin: '0 0 24px', color: '#1c1917', fontSize: '16px', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
                      Your jewellery is certified authentic. A Digital Jewellery Passport has been issued for your <strong>{itemName}</strong> by {issuedBy}.
                    </p>

                    {/* Passport UID */}
                    <table role="presentation" width="100%" style={{ backgroundColor: '#fafaf9', borderRadius: '10px', marginBottom: '24px' }}>
                      <tr>
                        <td style={{ padding: '20px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 6px', color: '#78716c', fontSize: '11px', fontFamily: 'sans-serif', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Passport ID
                          </p>
                          <p style={{ margin: 0, color: '#1c1917', fontSize: '20px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '3px' }}>
                            {passportUid}
                          </p>
                        </td>
                      </tr>
                    </table>

                    {/* CTA */}
                    <table role="presentation" width="100%" style={{ marginBottom: '24px' }}>
                      <tr>
                        <td align="center">
                          <a
                            href={verificationUrl}
                            style={{
                              display: 'inline-block',
                              backgroundColor: 'amber-700',
                              color: '#ffffff',
                              textDecoration: 'none',
                              padding: '14px 36px',
                              borderRadius: '8px',
                              fontSize: '15px',
                              fontFamily: 'sans-serif',
                              fontWeight: 600,
                              letterSpacing: '0.5px',
                            }}
                          >
                            View Your Passport →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style={{ margin: '0 0 4px', color: '#a8a29e', fontSize: '12px', fontFamily: 'sans-serif', textAlign: 'center' }}>
                      Or copy this link:
                    </p>
                    <p style={{ margin: 0, color: 'amber-700', fontSize: '12px', fontFamily: 'monospace', textAlign: 'center', wordBreak: 'break-all' }}>
                      {verificationUrl}
                    </p>
                  </td>
                </tr>

                {/* Divider */}
                <tr>
                  <td style={{ padding: '0 40px' }}>
                    <hr style={{ border: 'none', borderTop: '1px solid #e7e5e4', margin: 0 }} />
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{ padding: '24px 40px 32px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', color: '#a8a29e', fontSize: '12px', fontFamily: 'sans-serif' }}>
                      Issued by <strong style={{ color: '#78716c' }}>{issuedBy}</strong>
                    </p>
                    {businessEmail && (
                      <p style={{ margin: 0, color: '#a8a29e', fontSize: '12px', fontFamily: 'sans-serif' }}>
                        <a href={`mailto:${businessEmail}`} style={{ color: 'amber-700', textDecoration: 'none' }}>{businessEmail}</a>
                      </p>
                    )}
                    <p style={{ margin: '16px 0 0', color: '#d6d3d1', fontSize: '11px', fontFamily: 'sans-serif' }}>
                      Powered by Nexpura · Digital Jewellery Passports
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}
