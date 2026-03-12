import React from 'react'

export interface LowStockAlertEmailProps {
  businessName: string
  items: Array<{ name: string; sku: string; quantity: number }>
  inventoryUrl: string
}

export default function LowStockAlertEmail({ businessName, items, inventoryUrl }: LowStockAlertEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Low stock alert — {businessName}</title>
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
                        <div style={{ display: 'inline-block', backgroundColor: '#F59E0B', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
                          ⚠️ Low Stock Alert
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#071A0D', fontFamily: 'Georgia, serif' }}>
                          Low stock alert — {items.length} item{items.length === 1 ? '' : 's'} need attention
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.7' }}>
                          The following items are running low in your inventory and may need to be restocked.
                        </p>
                        {/* Items table */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #E8E8E8', marginBottom: '32px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8F5F0' }}>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Item</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>SKU</th>
                              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, i) => (
                              <tr key={i} style={{ borderTop: '1px solid #E8E8E8' }}>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#071A0D', fontWeight: '500' }}>{item.name}</td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6B7280', fontFamily: 'monospace' }}>{item.sku}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', color: item.quantity === 0 ? '#EF4444' : '#F59E0B', fontWeight: '700' }}>{item.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <table cellPadding={0} cellSpacing={0} style={{ margin: '0 auto' }}>
                          <tbody>
                            <tr>
                              <td>
                                <a href={inventoryUrl} style={{ display: 'inline-block', backgroundColor: '#52B788', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                                  View inventory →
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
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
