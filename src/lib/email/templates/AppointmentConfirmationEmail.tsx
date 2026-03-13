import * as React from 'react'

export interface AppointmentConfirmationEmailProps {
  customerName: string
  appointmentType: string
  preferredDate: string
  preferredTime?: string | null
  businessName: string
  businessEmail?: string | null
  businessPhone?: string | null
  businessAddress?: string | null
  notes?: string | null
}

export default function AppointmentConfirmationEmail({
  customerName,
  appointmentType,
  preferredDate,
  preferredTime,
  businessName,
  businessEmail,
  businessPhone,
  businessAddress,
  notes,
}: AppointmentConfirmationEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Appointment Confirmation</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#fafaf9', fontFamily: 'sans-serif' }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#fafaf9', padding: '40px 20px' }}>
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style={{ maxWidth: '560px', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                {/* Header */}
                <tr>
                  <td style={{ backgroundColor: '#1c1917', padding: '32px 40px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px', color: '#8B7355', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>
                      {businessName}
                    </p>
                    <h1 style={{ margin: 0, color: '#ffffff', fontSize: '24px', fontFamily: 'Georgia, serif', fontWeight: 400 }}>
                      Appointment Request Received
                    </h1>
                  </td>
                </tr>

                {/* Body */}
                <tr>
                  <td style={{ padding: '36px 40px' }}>
                    <p style={{ margin: '0 0 20px', color: '#44403c', fontSize: '15px', lineHeight: '1.6' }}>
                      Dear {customerName},
                    </p>
                    <p style={{ margin: '0 0 28px', color: '#44403c', fontSize: '15px', lineHeight: '1.6' }}>
                      Thank you for requesting an appointment. We&apos;ve received your request and will be in touch shortly to confirm.
                    </p>

                    {/* Appointment details */}
                    <table role="presentation" width="100%" style={{ backgroundColor: '#fafaf9', borderRadius: '10px', marginBottom: '28px' }}>
                      <tr>
                        <td style={{ padding: '24px' }}>
                          <p style={{ margin: '0 0 16px', color: '#78716c', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                            Appointment Details
                          </p>
                          <table role="presentation" width="100%">
                            <tr>
                              <td style={{ paddingBottom: '10px' }}>
                                <span style={{ color: '#a8a29e', fontSize: '12px' }}>Type</span><br />
                                <span style={{ color: '#1c1917', fontSize: '15px', fontWeight: 600 }}>{appointmentType}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style={{ paddingBottom: '10px' }}>
                                <span style={{ color: '#a8a29e', fontSize: '12px' }}>Preferred Date</span><br />
                                <span style={{ color: '#1c1917', fontSize: '15px', fontWeight: 600 }}>{preferredDate}</span>
                              </td>
                            </tr>
                            {preferredTime && (
                              <tr>
                                <td style={{ paddingBottom: '10px' }}>
                                  <span style={{ color: '#a8a29e', fontSize: '12px' }}>Preferred Time</span><br />
                                  <span style={{ color: '#1c1917', fontSize: '15px', fontWeight: 600 }}>{preferredTime}</span>
                                </td>
                              </tr>
                            )}
                            {notes && (
                              <tr>
                                <td>
                                  <span style={{ color: '#a8a29e', fontSize: '12px' }}>Notes</span><br />
                                  <span style={{ color: '#44403c', fontSize: '14px' }}>{notes}</span>
                                </td>
                              </tr>
                            )}
                          </table>
                        </td>
                      </tr>
                    </table>

                    {/* Contact details */}
                    {(businessEmail || businessPhone || businessAddress) && (
                      <div>
                        <p style={{ margin: '0 0 12px', color: '#78716c', fontSize: '13px', fontWeight: 600 }}>
                          Contact us:
                        </p>
                        {businessPhone && <p style={{ margin: '0 0 4px', color: '#44403c', fontSize: '14px' }}>📞 {businessPhone}</p>}
                        {businessEmail && (
                          <p style={{ margin: '0 0 4px', color: '#44403c', fontSize: '14px' }}>
                            ✉️ <a href={`mailto:${businessEmail}`} style={{ color: '#8B7355' }}>{businessEmail}</a>
                          </p>
                        )}
                        {businessAddress && <p style={{ margin: 0, color: '#44403c', fontSize: '14px' }}>📍 {businessAddress}</p>}
                      </div>
                    )}
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{ padding: '20px 40px 32px', borderTop: '1px solid #f5f5f4', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: '#a8a29e', fontSize: '12px' }}>
                      This email was sent by <strong>{businessName}</strong>
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
