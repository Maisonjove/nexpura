import { createAdminClient } from '@/lib/supabase/admin'

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nexpura.com'

export interface EmailResult {
  success: boolean
  error?: string
  emailId?: string
}

// Supabase can return relations as array or object depending on the query
export function first<T>(val: unknown): T | null {
  if (!val) return null
  if (Array.isArray(val)) return (val[0] as T) ?? null
  return val as T
}

export async function logEmail(params: {
  tenantId: string
  emailType: string
  recipient: string
  subject: string
  resendId?: string
  referenceType?: string
  referenceId?: string
}) {
  const admin = createAdminClient()
  await admin.from('email_logs').insert({
    tenant_id: params.tenantId,
    email_type: params.emailType,
    recipient: params.recipient,
    subject: params.subject,
    resend_id: params.resendId ?? null,
    status: 'sent',
    reference_type: params.referenceType ?? null,
    reference_id: params.referenceId ?? null,
  })
}
