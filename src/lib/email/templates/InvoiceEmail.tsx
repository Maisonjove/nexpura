import React from 'react'

export interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  discount_pct: number
  total: number
}

export interface InvoiceEmailProps {
  invoiceNumber: string
  businessName: string
  businessEmail: string | null
  customerName: string
  invoiceDate: string
  dueDate: string | null
  subtotal: number
  taxAmount: number
  taxName: string
  discountAmount: number
  total: number
  amountPaid: number
  amountDue: number
  lineItems: InvoiceLineItem[]
  invoiceUrl: string
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function InvoiceEmail({
  invoiceNumber,
  businessName,
  businessEmail,
  customerName,
  invoiceDate,
  dueDate,
  subtotal,
  taxAmount,
  taxName,
  discountAmount,
  total,
  amountPaid,
  amountDue,
  lineItems,
  invoiceUrl,
}: InvoiceEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice {invoiceNumber} from {businessName}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#F8F5F0', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', padding: '40px 20px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="600" cellPadding={0} cellSpacing={0} style={{ maxWidth: '600px', width: '100%' }}>
                  {/* Header */}
                  <tbody>
                    <tr>
                      <td style={{ backgroundColor: '#071A0D', borderRadius: '12px 12px 0 0', padding: '32px 40px' }}>
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td>
                                <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#52B788', letterSpacing: '0.05em', fontFamily: 'Georgia, serif' }}>
                                  nexpura
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(248,245,240,0.6)', letterSpacing: '0.03em' }}>
                                  {businessName}
                                </p>
                              </td>
                              <td align="right">
                                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(248,245,240,0.5)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                  Invoice
                                </p>
                                <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '700', color: '#F8F5F0' }}>
                                  {invoiceNumber}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* Body */}
                    <tr>
                      <td style={{ backgroundColor: '#FFFFFF', padding: '40px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '16px', color: '#071A0D', fontWeight: '600' }}>
                          Hi {customerName},
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
                          Please find your invoice from <strong>{businessName}</strong> below.
                        </p>

                        {/* Invoice summary box */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F8F5F0', borderRadius: '8px', marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '20px 24px' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ paddingBottom: '12px', width: '50%' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Invoice #</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '600' }}>{invoiceNumber}</p>
                                      </td>
                                      <td style={{ paddingBottom: '12px', width: '50%' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Invoice Date</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: '#071A0D', fontWeight: '600' }}>
                                          {new Date(invoiceDate + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style={{ width: '50%' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Due Date</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '14px', color: dueDate ? '#071A0D' : '#9CA3AF', fontWeight: '600' }}>
                                          {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : 'On Receipt'}
                                        </p>
                                      </td>
                                      <td style={{ width: '50%' }}>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Amount Due</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '18px', color: '#071A0D', fontWeight: '700' }}>
                                          {fmt(amountDue)}
                                        </p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Line items */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #E8E8E8' }}>
                              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Description</th>
                              <th style={{ textAlign: 'center', padding: '8px 0', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', width: '60px' }}>Qty</th>
                              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', width: '80px' }}>Price</th>
                              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', width: '80px' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #F8F5F0' }}>
                                <td style={{ padding: '12px 0', fontSize: '14px', color: '#071A0D' }}>
                                  {item.description}
                                  {item.discount_pct > 0 && (
                                    <span style={{ display: 'block', fontSize: '12px', color: '#52B788' }}>{item.discount_pct}% discount</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 0', fontSize: '14px', color: '#4a5568', textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ padding: '12px 0', fontSize: '14px', color: '#4a5568', textAlign: 'right' }}>{fmt(item.unit_price)}</td>
                                <td style={{ padding: '12px 0', fontSize: '14px', color: '#071A0D', fontWeight: '600', textAlign: 'right' }}>{fmt(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Totals */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '32px' }}>
                          <tbody>
                            <tr>
                              <td colSpan={2} style={{ width: '55%' }} />
                              <td style={{ width: '45%' }}>
                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                  <tbody>
                                    <tr>
                                      <td style={{ padding: '6px 0', fontSize: '13px', color: '#6B7280' }}>Subtotal</td>
                                      <td style={{ padding: '6px 0', fontSize: '13px', color: '#071A0D', textAlign: 'right' }}>{fmt(subtotal)}</td>
                                    </tr>
                                    {taxAmount > 0 && (
                                      <tr>
                                        <td style={{ padding: '6px 0', fontSize: '13px', color: '#6B7280' }}>{taxName}</td>
                                        <td style={{ padding: '6px 0', fontSize: '13px', color: '#071A0D', textAlign: 'right' }}>{fmt(taxAmount)}</td>
                                      </tr>
                                    )}
                                    {discountAmount > 0 && (
                                      <tr>
                                        <td style={{ padding: '6px 0', fontSize: '13px', color: '#52B788' }}>Discount</td>
                                        <td style={{ padding: '6px 0', fontSize: '13px', color: '#52B788', textAlign: 'right' }}>-{fmt(discountAmount)}</td>
                                      </tr>
                                    )}
                                    <tr style={{ borderTop: '2px solid #071A0D' }}>
                                      <td style={{ padding: '10px 0 6px', fontSize: '14px', color: '#071A0D', fontWeight: '700' }}>Total</td>
                                      <td style={{ padding: '10px 0 6px', fontSize: '14px', color: '#071A0D', fontWeight: '700', textAlign: 'right' }}>{fmt(total)}</td>
                                    </tr>
                                    {amountPaid > 0 && (
                                      <tr>
                                        <td style={{ padding: '6px 0', fontSize: '13px', color: '#52B788' }}>Amount Paid</td>
                                        <td style={{ padding: '6px 0', fontSize: '13px', color: '#52B788', textAlign: 'right' }}>{fmt(amountPaid)}</td>
                                      </tr>
                                    )}
                                    {amountPaid > 0 && (
                                      <tr style={{ borderTop: '1px solid #E8E8E8' }}>
                                        <td style={{ padding: '10px 0 6px', fontSize: '15px', color: '#071A0D', fontWeight: '800' }}>Amount Due</td>
                                        <td style={{ padding: '10px 0 6px', fontSize: '15px', color: '#071A0D', fontWeight: '800', textAlign: 'right' }}>{fmt(amountDue)}</td>
                                      </tr>
                                    )}
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
                                  href={invoiceUrl}
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
                                  View Invoice Online
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {businessEmail && (
                          <p style={{ margin: '0 0 0', fontSize: '13px', color: '#6B7280', textAlign: 'center', lineHeight: '1.6' }}>
                            Questions? Reply to this email or contact us at{' '}
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
                          This invoice was sent on behalf of {businessName}. Nexpura is not responsible for payment collection.
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
