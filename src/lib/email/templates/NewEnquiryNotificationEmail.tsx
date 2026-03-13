import * as React from 'react'

export interface NewEnquiryNotificationEmailProps {
  businessName: string
  enquiryType: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  message: string
  dashboardUrl: string
}

export default function NewEnquiryNotificationEmail({
  businessName,
  enquiryType,
  customerName,
  customerEmail,
  customerPhone,
  message,
  dashboardUrl,
}: NewEnquiryNotificationEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>New Enquiry Received</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#fafaf9', fontFamily: 'sans-serif' }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#fafaf9', padding: '40px 20px' }}>
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style={{ maxWidth: '560px', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                <tr>
                  <td style={{ backgroundColor: '#8B7355', padding: '28px 40px', textAlign: 'center' }}>
                    <h1 style={{ margin: 0, color: '#ffffff', fontSize: '20px', fontWeight: 600 }}>
                      🔔 New {enquiryType} Enquiry
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style={{ padding: '32px 40px' }}>
                    <p style={{ margin: '0 0 24px', color: '#44403c', fontSize: '15px', lineHeight: '1.6' }}>
                      You have a new enquiry on <strong>{businessName}</strong>.
                    </p>

                    <table role="presentation" width="100%" style={{ backgroundColor: '#fafaf9', borderRadius: '10px', marginBottom: '24px' }}>
                      <tr>
                        <td style={{ padding: '24px' }}>
                          <table role="presentation" width="100%">
                            {[
                              { label: 'Name', value: customerName },
                              { label: 'Email', value: customerEmail },
                              customerPhone ? { label: 'Phone', value: customerPhone } : null,
                              { label: 'Enquiry Type', value: enquiryType },
                            ].filter(Boolean).map((row, i) => (
                              <tr key={i}>
                                <td style={{ paddingBottom: '12px', width: '100px', verticalAlign: 'top' }}>
                                  <span style={{ color: '#a8a29e', fontSize: '12px' }}>{row!.label}</span>
                                </td>
                                <td style={{ paddingBottom: '12px', verticalAlign: 'top' }}>
                                  <span style={{ color: '#1c1917', fontSize: '14px', fontWeight: 600 }}>{row!.value}</span>
                                </td>
                              </tr>
                            ))}
                          </table>
                        </td>
                      </tr>
                    </table>

                    {/* Message */}
                    <div style={{ backgroundColor: '#f5f0ea', borderLeft: '3px solid #8B7355', borderRadius: '4px', padding: '16px 20px', marginBottom: '28px' }}>
                      <p style={{ margin: '0 0 8px', color: '#78716c', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                        Message
                      </p>
                      <p style={{ margin: 0, color: '#44403c', fontSize: '14px', lineHeight: '1.6' }}>
                        {message}
                      </p>
                    </div>

                    <table role="presentation" width="100%">
                      <tr>
                        <td align="center">
                          <a
                            href={dashboardUrl}
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#1c1917',
                              color: '#ffffff',
                              textDecoration: 'none',
                              padding: '12px 28px',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: 600,
                            }}
                          >
                            View in Nexpura →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={{ padding: '16px 40px 24px', borderTop: '1px solid #f5f5f4', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: '#a8a29e', fontSize: '11px' }}>
                      Nexpura · Enquiry notification for {businessName}
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
