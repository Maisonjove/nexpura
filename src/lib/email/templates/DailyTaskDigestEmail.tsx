import React from 'react'

export interface TaskItem {
  id: string
  title: string
  description: string | null
  priority: string
  due_date: string | null
  department: string | null
}

export interface DailyTaskDigestEmailProps {
  employeeName: string
  tasks: TaskItem[]
  businessName: string
  dashboardUrl: string
}

export default function DailyTaskDigestEmail({
  employeeName,
  tasks,
  businessName,
  dashboardUrl,
}: DailyTaskDigestEmailProps) {
  const pendingTasks = tasks.filter(t => t.priority !== 'urgent' && t.priority !== 'high');
  const urgentTasks = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high');

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Daily Tasks — {businessName}</title>
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
                      <td style={{ backgroundColor: '#1A1A1A', borderRadius: '12px 12px 0 0', padding: '32px 40px' }}>
                        <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'amber-700', letterSpacing: '0.05em', fontFamily: 'Georgia, serif' }}>
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
                        <p style={{ margin: '0 0 8px', fontSize: '18px', color: '#071A0D', fontWeight: '600' }}>
                          Good Morning {employeeName},
                        </p>
                        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
                          Here is your task summary for today, Saturday, March 14, 2026.
                        </p>

                        {urgentTasks.length > 0 && (
                          <div style={{ marginBottom: '32px' }}>
                            <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '700', color: 'amber-700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              ⚠️ High Priority & Urgent
                            </p>
                            <table width="100%" cellPadding={0} cellSpacing={0}>
                              <tbody>
                                {urgentTasks.map(task => (
                                  <tr key={task.id}>
                                    <td style={{ padding: '12px', backgroundColor: '#FFFBEB', borderLeft: '4px solid #F59E0B', marginBottom: '8px', borderRadius: '0 4px 4px 0' }}>
                                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#92400E' }}>{task.title}</p>
                                      {task.description && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'amber-700' }}>{task.description}</p>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div>
                          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '700', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Tasks for Today ({tasks.length})
                          </p>
                          {tasks.length === 0 ? (
                            <p style={{ margin: 0, fontSize: '14px', color: '#9CA3AF', fontStyle: 'italic' }}>No tasks assigned for today.</p>
                          ) : (
                            <table width="100%" cellPadding={0} cellSpacing={0}>
                              <tbody>
                                {tasks.map(task => (
                                  <tr key={task.id}>
                                    <td style={{ padding: '12px 0', borderBottom: '1px solid #F0F0F0' }}>
                                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#1A1A1A' }}>{task.title}</p>
                                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF' }}>
                                        {task.department ? `${task.department} · ` : ''}
                                        {task.due_date ? `Due: ${task.due_date}` : 'No due date'}
                                      </p>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        <div style={{ marginTop: '40px', textAlign: 'center' }}>
                          <a href={dashboardUrl} style={{ display: 'inline-block', backgroundColor: 'amber-700', color: '#FFFFFF', fontSize: '14px', fontWeight: '600', padding: '12px 32px', borderRadius: '8px', textDecoration: 'none' }}>
                            Open Dashboard
                          </a>
                        </div>
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={{ backgroundColor: '#F8F5F0', borderRadius: '0 0 12px 12px', padding: '24px 40px', borderTop: '1px solid #E8E8E8' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                          Sent via{' '}
                          <a href="https://nexpura.com" style={{ color: 'amber-700', textDecoration: 'none', fontWeight: '600' }}>
                            Nexpura
                          </a>
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
