import React from 'react'

export interface RepairReceivedEmailProps {
  customerName: string
  repairNumber: string
  itemType: string
  itemDescription: string
  estimatedCompletion: string | null
  businessName: string
  businessPhone: string | null
}

export default function RepairReceivedEmail({
  customerName,
  repairNumber,
  itemType,
  itemDescription,
  estimatedCompletion,
  businessName,
  businessPhone,
}: RepairReceivedEmailProps) {
  const estDate = estimatedCompletion
    ? new Date(estimatedCompletion).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>We've received your {itemType} — {businessName}</title>
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
                        <div style={{ display: 'inline-block', backgroundColor: '#3B82F6', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          ✓ Repair Received
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '600', color: '#071A0D' }}>
                          Hi {customerName},
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
                          We've received your <strong>{itemType}</strong> for repair. Your repair reference number is below.
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '24px', textAlign: 'center' as const }}>
                                <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Your Repair Reference</p>
                                <p style={{ margin: '8px 0 0', fontSize: '32px', fontWeight: '800', color: '#071A0D', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{repairNumber}</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderRadius: '8px', border: '1px solid #E8E8E8', marginBottom: '24px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '20px 24px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Item</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '600', textTransform: 'capitalize' }}>{itemType}</p>
                                      </td>
                                      {estDate && (
                                        <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top' }}>
                                          <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Estimated Completion</p>
                                          <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '600' }}>{estDate}</p>
                                        </td>
                                      )}
                                    </tr>
                                    <tr>
                                      <td colSpan={2} style={{ paddingBottom: '14px', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Description</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D' }}>{itemDescription}</p>
                                      </td>
                                    </tr>
                                    {businessPhone && (
                                      <tr>
                                        <td colSpan={2} style={{ borderTop: '1px solid #E8E8E8', paddingTop: '14px', verticalAlign: 'top' }}>
                                          <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Contact</p>
                                          <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#4a5568' }}>{businessPhone}</p>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', textAlign: 'center' }}>
                          We'll notify you when your repair is complete and ready for collection.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#F8F5F0', borderRadius: '0 0 12px 12px', padding: '24px 40px', borderTop: '1px solid #E8E8E8' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                          Sent via <a href="https://nexpura.com" style={{ color: '#52B788', textDecoration: 'none', fontWeight: '600' }}>Nexpura</a>
                          {' · '}This notification was sent on behalf of {businessName}.
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
