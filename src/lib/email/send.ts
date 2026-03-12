import { createElement } from 'react'
import { resend } from './resend'
import { createAdminClient } from '@/lib/supabase/admin'
import InvoiceEmail from './templates/InvoiceEmail'
import JobReadyEmail from './templates/JobReadyEmail'
import RepairReadyEmail from './templates/RepairReadyEmail'
import QuoteEmail from './templates/QuoteEmail'
import PassportEmail from './templates/PassportEmail'
import type { InvoiceEmailProps } from './templates/InvoiceEmail'
import type { JobReadyEmailProps } from './templates/JobReadyEmail'
import type { RepairReadyEmailProps } from './templates/RepairReadyEmail'
import type { QuoteEmailProps } from './templates/QuoteEmail'
import type { PassportEmailProps } from './templates/PassportEmail'

const APP_URL = 'https://nexpura-delta.vercel.app'

// Supabase can return relations as array or object depending on the query
function first<T>(val: unknown): T | null {
  if (!val) return null
  if (Array.isArray(val)) return (val[0] as T) ?? null
  return val as T
}

interface EmailResult {
  success: boolean
  error?: string
  emailId?: string
}

async function logEmail(params: {
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

// ─────────────────────────────────────────────────────────────
// Invoice Email
// ─────────────────────────────────────────────────────────────

export async function sendInvoiceEmail(invoiceId: string): Promise<EmailResult> {
  const admin = createAdminClient()

  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select(`
      id, invoice_number, invoice_date, due_date,
      subtotal, tax_amount, tax_name, discount_amount, total, amount_paid,
      customer_id, tenant_id,
      customers (id, full_name, email),
      invoice_line_items (id, description, quantity, unit_price, discount_pct, total, sort_order)
    `)
    .eq('id', invoiceId)
    .single()

  if (invErr || !invoice) {
    return { success: false, error: 'Invoice not found' }
  }

  const customer = first<{ id: string; full_name: string | null; email: string | null }>(invoice.customers)
  if (!customer?.email) {
    return { success: false, error: 'Customer has no email address' }
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email')
    .eq('id', invoice.tenant_id)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'
  const amountDue = invoice.total - (invoice.amount_paid || 0)

  const lineItems = (invoice.invoice_line_items as unknown as Array<{
    id: string; description: string; quantity: number; unit_price: number; discount_pct: number; total: number; sort_order: number
  }>).sort((a, b) => a.sort_order - b.sort_order)

  const props: InvoiceEmailProps = {
    invoiceNumber: invoice.invoice_number,
    businessName,
    businessEmail: tenant?.email ?? null,
    customerName: customer.full_name || 'Valued Customer',
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date ?? null,
    subtotal: invoice.subtotal,
    taxAmount: invoice.tax_amount,
    taxName: invoice.tax_name || 'GST',
    discountAmount: invoice.discount_amount || 0,
    total: invoice.total,
    amountPaid: invoice.amount_paid || 0,
    amountDue,
    lineItems,
    invoiceUrl: `${APP_URL}/invoices/${invoiceId}`,
  }

  const subject = `Invoice ${invoice.invoice_number} from ${businessName}`

  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [customer.email],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(InvoiceEmail, props),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await logEmail({
    tenantId: invoice.tenant_id,
    emailType: 'invoice',
    recipient: customer.email,
    subject,
    resendId: data?.id,
    referenceType: 'invoice',
    referenceId: invoiceId,
  })

  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Job Ready Email
// ─────────────────────────────────────────────────────────────

export async function sendJobReadyEmail(jobId: string): Promise<EmailResult> {
  const admin = createAdminClient()

  const { data: job, error: jobErr } = await admin
    .from('bespoke_jobs')
    .select(`
      id, job_number, title, jewellery_type, description,
      customer_id, tenant_id,
      customers (id, full_name, email)
    `)
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    return { success: false, error: 'Job not found' }
  }

  const customer = first<{ id: string; full_name: string | null; email: string | null }>(job.customers)
  if (!customer?.email) {
    return { success: false, error: 'Customer has no email address' }
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email, address_line1, suburb, state, postcode, phone')
    .eq('id', job.tenant_id)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'

  // Check if a passport exists for this job
  const { data: passport } = await admin
    .from('passports')
    .select('passport_uid')
    .eq('tenant_id', job.tenant_id)
    .limit(1)
    .maybeSingle()

  const businessAddress = tenant
    ? [tenant.address_line1, tenant.suburb, tenant.state, tenant.postcode]
        .filter(Boolean)
        .join(', ')
    : null

  const props: JobReadyEmailProps = {
    customerName: customer.full_name || 'Valued Customer',
    jobTitle: job.title,
    jewelleryType: job.jewellery_type ?? null,
    jobNumber: job.job_number,
    itemDescription: job.description ?? null,
    businessName,
    businessEmail: tenant?.email ?? null,
    businessPhone: tenant?.phone ?? null,
    businessAddress: businessAddress || null,
    passportUid: passport?.passport_uid ?? null,
  }

  const itemLabel = job.jewellery_type ? job.jewellery_type.replace(/_/g, ' ') : 'jewellery piece'
  const subject = `Your ${itemLabel} is ready for collection — ${businessName}`

  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [customer.email],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(JobReadyEmail, props),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await logEmail({
    tenantId: job.tenant_id,
    emailType: 'job_ready',
    recipient: customer.email,
    subject,
    resendId: data?.id,
    referenceType: 'bespoke_job',
    referenceId: jobId,
  })

  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Repair Ready Email
// ─────────────────────────────────────────────────────────────

export async function sendRepairReadyEmail(repairId: string): Promise<EmailResult> {
  const admin = createAdminClient()

  const { data: repair, error: repairErr } = await admin
    .from('repairs')
    .select(`
      id, repair_number, item_type, item_description, work_description,
      customer_id, tenant_id,
      customers (id, full_name, email)
    `)
    .eq('id', repairId)
    .single()

  if (repairErr || !repair) {
    return { success: false, error: 'Repair not found' }
  }

  const customer = first<{ id: string; full_name: string | null; email: string | null }>(repair.customers)
  if (!customer?.email) {
    return { success: false, error: 'Customer has no email address' }
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email, address_line1, suburb, state, postcode, phone')
    .eq('id', repair.tenant_id)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'
  const businessAddress = tenant
    ? [tenant.address_line1, tenant.suburb, tenant.state, tenant.postcode]
        .filter(Boolean)
        .join(', ')
    : null

  const props: RepairReadyEmailProps = {
    customerName: customer.full_name || 'Valued Customer',
    itemType: repair.item_type,
    repairNumber: repair.repair_number,
    itemDescription: repair.item_description || repair.item_type,
    workDescription: repair.work_description ?? null,
    businessName,
    businessEmail: tenant?.email ?? null,
    businessPhone: tenant?.phone ?? null,
    businessAddress: businessAddress || null,
  }

  const subject = `Your repair is ready — ${businessName}`

  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [customer.email],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(RepairReadyEmail, props),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await logEmail({
    tenantId: repair.tenant_id,
    emailType: 'repair_ready',
    recipient: customer.email,
    subject,
    resendId: data?.id,
    referenceType: 'repair',
    referenceId: repairId,
  })

  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Quote Email
// ─────────────────────────────────────────────────────────────

export async function sendQuoteEmail(repairId: string, quotedPrice: number): Promise<EmailResult> {
  const admin = createAdminClient()

  const { data: repair, error: repairErr } = await admin
    .from('repairs')
    .select(`
      id, repair_number, item_type, item_description, work_description,
      due_date, customer_id, tenant_id,
      customers (id, full_name, email)
    `)
    .eq('id', repairId)
    .single()

  if (repairErr || !repair) {
    return { success: false, error: 'Repair not found' }
  }

  const customer = first<{ id: string; full_name: string | null; email: string | null }>(repair.customers)
  if (!customer?.email) {
    return { success: false, error: 'Customer has no email address' }
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email, phone')
    .eq('id', repair.tenant_id)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'

  const props: QuoteEmailProps = {
    customerName: customer.full_name || 'Valued Customer',
    itemType: repair.item_type,
    itemDescription: repair.item_description || repair.item_type,
    repairNumber: repair.repair_number,
    workDescription: repair.work_description ?? null,
    quotedPrice,
    estimatedCompletion: repair.due_date ?? null,
    businessName,
    businessEmail: tenant?.email ?? null,
    businessPhone: tenant?.phone ?? null,
  }

  const subject = `Quote for your ${repair.item_description || repair.item_type} — ${businessName}`

  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [customer.email],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(QuoteEmail, props),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await logEmail({
    tenantId: repair.tenant_id,
    emailType: 'quote',
    recipient: customer.email,
    subject,
    resendId: data?.id,
    referenceType: 'repair',
    referenceId: repairId,
  })

  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Passport Email
// ─────────────────────────────────────────────────────────────

export async function sendPassportEmail(passportId: string): Promise<EmailResult> {
  const admin = createAdminClient()

  const { data: passport, error: passportErr } = await admin
    .from('passports')
    .select(`
      id, passport_uid, title, jewellery_type,
      current_owner_name, current_owner_email,
      tenant_id
    `)
    .eq('id', passportId)
    .single()

  if (passportErr || !passport) {
    return { success: false, error: 'Passport not found' }
  }

  if (!passport.current_owner_email) {
    return { success: false, error: 'Passport has no owner email address' }
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email')
    .eq('id', passport.tenant_id)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'

  const props: PassportEmailProps = {
    ownerName: passport.current_owner_name || 'Valued Customer',
    title: passport.title,
    passportUid: passport.passport_uid,
    jewelleryType: passport.jewellery_type ?? null,
    issuedBy: businessName,
    businessEmail: tenant?.email ?? null,
  }

  const subject = `Your Digital Jewellery Passport — ${passport.title}`

  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [passport.current_owner_email],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(PassportEmail, props),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await logEmail({
    tenantId: passport.tenant_id,
    emailType: 'passport',
    recipient: passport.current_owner_email,
    subject,
    resendId: data?.id,
    referenceType: 'passport',
    referenceId: passportId,
  })

  return { success: true, emailId: data?.id }
}
