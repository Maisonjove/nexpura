import * as React from 'react'

export interface RepairEnquiryConfirmationEmailProps {
  customerName: string
  itemDescription: string
  repairDescription: string
  businessName: string
  businessEmail?: string | null
  businessPhone?: string | null
}

export default function RepairEnquiryConfirmationEmail({
  customerName,
  itemDescription,
  repairDescription,
  businessName,
  businessEmail,
  businessPhone,
}: RepairEnquiryConfirmationEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Repair Enquiry Received</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#fafaf9', fontFamily: 'sans-serif' }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#fafaf9', padding: '40px 20px' }}>
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style={{ maxWidth: '560px', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                <tr>
                  <td style={{ backgroundColor: '#1c1917', padding: '32px 40px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px', color: '#8B7355', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>
                      {businessName}
                    </p>
                    <h1 style={{ margin: 0, color: '#ffffff', fontSize: '24px', fontFamily: 'Georgia, serif', fontWeight: 400 }}>
                      Repair Enquiry Received
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style={{ padding: '36px 40px' }}>
                    <p style={{ margin: '0 0 20px', color: '#44403c', fontSize: '15px', lineHeight: '1.6' }}>
                      Dear {customerName},
                    </p>
                    <p style={{ margin: '0 0 28px', color: '#44403c', fontSize: '15px', lineHeight: '1.6' }}>
                      We&apos;ve received your repair enquiry and will be in touch shortly with a quote and timeline.
                    </p>

                    <table role="presentation" width="100%" style={{ backgroundColor: '#fafaf9', borderRadius: '10px', marginBottom: '28px' }}>
                      <tr>
                        <td style={{ padding: '24px' }}>
                          <p style={{ margin: '0 0 16px', color: '#78716c', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                            Enquiry Summary
                          </p>
                          <p style={{ margin: '0 0 10px', color: '#a8a29e', fontSize: '12px' }}>Item</p>
                          <p style={{ margin: '0 0 16px', color: '#1c1917', fontSize: '15px', fontWeight: 600 }}>{itemDescription}</p>
                          <p style={{ margin: '0 0 10px', color: '#a8a29e', fontSize: '12px' }}>Repair Description</p>
                          <p style={{ margin: 0, color: '#44403c', fontSize: '14px', lineHeight: '1.5' }}>{repairDescription}</p>
                        </td>
                      </tr>
                    </table>

                    {(businessEmail || businessPhone) && (
                      <p style={{ margin: 0, color: '#44403c', fontSize: '14px', lineHeight: '1.8' }}>
                        Questions? Reach us at{' '}
                        {businessPhone && <span>📞 {businessPhone}</span>}
                        {businessEmail && (
                          <span> · <a href={`mailto:${businessEmail}`} style={{ color: '#8B7355' }}>{businessEmail}</a></span>
                        )}
                      </p>
                    )}
                  </td>
                </tr>

                <tr>
                  <td style={{ padding: '20px 40px 32px', borderTop: '1px solid #f5f5f4', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: '#a8a29e', fontSize: '12px' }}>
                      {businessName}
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
