import React from 'react'

export interface QuoteEmailProps {
  customerName: string
  itemType: string
  itemDescription: string
  repairNumber: string
  workDescription: string | null
  quotedPrice: number
  estimatedCompletion: string | null
  businessName: string
  businessEmail: string | null
  businessPhone: string | null
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function QuoteEmail({
  customerName,
  itemType,
  itemDescription,
  repairNumber,
  workDescription,
  quotedPrice,
  estimatedCompletion,
  businessName,
  businessEmail,
  businessPhone,
}: QuoteEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Quote for your {itemDescription} — {businessName}</title>
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
                        {/* Quote badge */}
                        <div style={{ display: 'inline-block', backgroundColor: '#C9A96E', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          Quote
                        </div>

                        <p style={{ margin: '0 0 8px', fontSize: '16px', color: '#071A0D', fontWeight: '600' }}>
                          Hi {customerName},
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
                          Thank you for bringing your <strong>{itemType}</strong> to us. Here is your quote:
                        </p>

                        {/* Quote details box */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '20px 24px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Reference</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '700', fontFamily: 'monospace' }}>{repairNumber}</p>
                                      </td>
                                      <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Item</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '600', textTransform: 'capitalize' }}>{itemType}</p>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td colSpan={2} style={{ paddingBottom: '14px', verticalAlign: 'top' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Item Description</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D' }}>{itemDescription}</p>
                                      </td>
                                    </tr>
                                    {workDescription && (
                                      <tr>
                                        <td colSpan={2} style={{ paddingBottom: '14px', verticalAlign: 'top' }}>
                                          <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Description of Work</p>
                                          <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D' }}>{workDescription}</p>
                                        </td>
                                      </tr>
                                    )}
                                    <tr>
                                      <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top', borderTop: '1px solid #E8E8E8', paddingTop: '14px' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Quoted Price</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '22px', color: '#071A0D', fontWeight: '800' }}>{fmt(quotedPrice)}</p>
                                      </td>
                                      {estimatedCompletion && (
                                        <td style={{ paddingBottom: '14px', width: '50%', verticalAlign: 'top', borderTop: '1px solid #E8E8E8', paddingTop: '14px' }}>
                                          <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Est. Completion</p>
                                          <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '600' }}>
                                            {new Date(estimatedCompletion + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                                          </p>
                                        </td>
                                      )}
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
                          To approve this quote, please reply to this email{businessPhone ? ` or call us at ${businessPhone}` : ''}.
                        </p>
                        <p style={{ margin: '0', fontSize: '13px', color: '#9CA3AF', lineHeight: '1.6', fontStyle: 'italic' }}>
                          This quote is valid for 30 days. Prices may vary if additional work is discovered during the repair process.
                        </p>
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
                          This quote was sent on behalf of {businessName}.
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
