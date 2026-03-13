import { createElement } from 'react'
import { resend } from './resend'
import { createAdminClient } from '@/lib/supabase/admin'
import InvoiceEmail from './templates/InvoiceEmail'
import JobReadyEmail from './templates/JobReadyEmail'
import RepairReadyEmail from './templates/RepairReadyEmail'
import QuoteEmail from './templates/QuoteEmail'
import PassportEmail from './templates/PassportEmail'
import SubscriptionWelcomeEmail from './templates/SubscriptionWelcomeEmail'
import TrialEndingSoonEmail from './templates/TrialEndingSoonEmail'
import PaymentSuccessEmail from './templates/PaymentSuccessEmail'
import PaymentFailedEmail from './templates/PaymentFailedEmail'
import GracePeriodStartedEmail from './templates/GracePeriodStartedEmail'
import GracePeriod24hEmail from './templates/GracePeriod24hEmail'
import AccountSuspendedEmail from './templates/AccountSuspendedEmail'
import AccountReactivatedEmail from './templates/AccountReactivatedEmail'
import RepairReceivedEmail from './templates/RepairReceivedEmail'
import UserInvitedEmail from './templates/UserInvitedEmail'
import LowStockAlertEmail from './templates/LowStockAlertEmail'
import FreeToPaidConversionEmail from './templates/FreeToPaidConversionEmail'
import CancellationEmail from './templates/CancellationEmail'
import PassportVerificationEmail from './templates/PassportVerificationEmail'
import AppointmentConfirmationEmail from './templates/AppointmentConfirmationEmail'
import RepairEnquiryConfirmationEmail from './templates/RepairEnquiryConfirmationEmail'
import NewEnquiryNotificationEmail from './templates/NewEnquiryNotificationEmail'
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

// ─────────────────────────────────────────────────────────────
// Subscription Welcome Email
// ─────────────────────────────────────────────────────────────

export async function sendSubscriptionWelcomeEmail(tenantId: string): Promise<EmailResult> {
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email')
    .eq('id', tenantId)
    .single()

  if (!tenant?.email) {
    return { success: false, error: 'Tenant has no email' }
  }

  const { data: sub } = await admin
    .from('subscriptions')
    .select('trial_ends_at')
    .eq('tenant_id', tenantId)
    .single()

  const businessName = tenant.business_name || tenant.name || 'Your Business'
  const trialEndsAt = sub?.trial_ends_at ?? new Date(Date.now() + 14 * 86400000).toISOString()

  const subject = `Welcome to Nexpura, ${businessName}!`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [tenant.email],
    subject,
    react: createElement(SubscriptionWelcomeEmail, {
      businessName,
      trialEndsAt,
      dashboardUrl: `${APP_URL}/dashboard`,
    }),
  })
  if (error) return { success: false, error: error.message }
  await logEmail({ tenantId, emailType: 'subscription_welcome', recipient: tenant.email, subject, resendId: data?.id })
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Trial Ending Soon Email
// ─────────────────────────────────────────────────────────────

export async function sendTrialEndingSoonEmail(email: string, name: string, trialEndsAt: string): Promise<EmailResult> {
  const trialEnd = new Date(trialEndsAt)
  const daysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const subject = `Your Nexpura trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`

  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(TrialEndingSoonEmail, {
      businessName: name,
      daysLeft,
      upgradeUrl: `${APP_URL}/billing`,
    }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Payment Success Email
// ─────────────────────────────────────────────────────────────

export async function sendPaymentSuccessEmail(
  email: string,
  businessName: string,
  amount: number,
  planName: string,
  nextBillingDate: string
): Promise<EmailResult> {
  const subject = `Payment confirmed — ${businessName}`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(PaymentSuccessEmail, { businessName, amount, planName, nextBillingDate }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Payment Failed Email
// ─────────────────────────────────────────────────────────────

export async function sendPaymentFailedEmail(email: string, name: string, amount: number, retryUrl: string): Promise<EmailResult> {
  const subject = `Payment failed — action required`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(PaymentFailedEmail, { businessName: name, amount, retryUrl }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Grace Period Started Email
// ─────────────────────────────────────────────────────────────

export async function sendGracePeriodStartedEmail(email: string, name: string, deadline: string, paymentUrl: string): Promise<EmailResult> {
  const subject = `Payment required — account suspension in 48 hours`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(GracePeriodStartedEmail, { businessName: name, hoursRemaining: 48, paymentUrl, deadline }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Grace Period 24h Email
// ─────────────────────────────────────────────────────────────

export async function sendGracePeriod24hEmail(email: string, name: string): Promise<EmailResult> {
  const subject = `🚨 24 hours remaining — pay now to avoid suspension`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(GracePeriod24hEmail, { businessName: name, paymentUrl: `${APP_URL}/billing` }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Account Suspended Email
// ─────────────────────────────────────────────────────────────

export async function sendAccountSuspendedEmail(email: string, name: string): Promise<EmailResult> {
  const subject = `Your Nexpura account has been suspended`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(AccountSuspendedEmail, { businessName: name, paymentUrl: `${APP_URL}/billing` }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Account Reactivated Email
// ─────────────────────────────────────────────────────────────

export async function sendAccountReactivatedEmail(email: string, name: string, planName: string): Promise<EmailResult> {
  const subject = `Your Nexpura account is back! 🎉`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(AccountReactivatedEmail, { businessName: name, planName, dashboardUrl: `${APP_URL}/dashboard` }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Repair Received Email
// ─────────────────────────────────────────────────────────────

export async function sendRepairReceivedEmail(repairId: string): Promise<EmailResult> {
  const admin = createAdminClient()

  const { data: repair, error: repairErr } = await admin
    .from('repairs')
    .select(`
      id, repair_number, item_type, item_description, due_date,
      customer_id, tenant_id,
      customers (id, full_name, email)
    `)
    .eq('id', repairId)
    .single()

  if (repairErr || !repair) return { success: false, error: 'Repair not found' }

  const customer = first<{ id: string; full_name: string | null; email: string | null }>(repair.customers)
  if (!customer?.email) return { success: false, error: 'Customer has no email address' }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email, phone')
    .eq('id', repair.tenant_id)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'
  const subject = `We've received your ${repair.item_type} — ${businessName}`

  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [customer.email],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(RepairReceivedEmail, {
      customerName: customer.full_name || 'Valued Customer',
      repairNumber: repair.repair_number,
      itemType: repair.item_type,
      itemDescription: repair.item_description || repair.item_type,
      estimatedCompletion: repair.due_date ?? null,
      businessName,
      businessPhone: tenant?.phone ?? null,
    }),
  })
  if (error) return { success: false, error: error.message }
  await logEmail({ tenantId: repair.tenant_id, emailType: 'repair_received', recipient: customer.email, subject, resendId: data?.id, referenceType: 'repair', referenceId: repairId })
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// User Invited Email
// ─────────────────────────────────────────────────────────────

export async function sendUserInvitedEmail(
  email: string,
  inviteeName: string,
  businessName: string,
  inviterName: string,
  role: string,
  acceptUrl: string
): Promise<EmailResult> {
  const subject = `You've been invited to join ${businessName} on Nexpura`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(UserInvitedEmail, { inviteeName, businessName, inviterName, role, acceptUrl }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Low Stock Alert Email
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Free To Paid Conversion Email
// ─────────────────────────────────────────────────────────────

export async function sendFreeToPaidConversionEmail(email: string, name: string, deadline: string): Promise<EmailResult> {
  const subject = `Payment required for your Nexpura account`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(FreeToPaidConversionEmail, {
      businessName: name,
      paymentUrl: `${APP_URL}/billing`,
      deadline,
    }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Cancellation Email
// ─────────────────────────────────────────────────────────────

export async function sendCancellationEmail(email: string, name: string): Promise<EmailResult> {
  const subject = `Your Nexpura subscription has been cancelled`
  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(CancellationEmail, {
      businessName: name,
      reactivateUrl: `${APP_URL}/billing`,
    }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

export async function sendLowStockAlertEmail(
  email: string,
  businessName: string,
  items: Array<{ name: string; sku: string; quantity: number }>,
  inventoryUrl: string
): Promise<EmailResult> {
  const subject = `Low stock alert — ${items.length} item${items.length === 1 ? '' : 's'} need attention`
  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [email],
    subject,
    react: createElement(LowStockAlertEmail, { businessName, items, inventoryUrl }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Passport Verification Email
// ─────────────────────────────────────────────────────────────

export async function sendPassportVerificationEmail(passportId: string): Promise<EmailResult> {
  const admin = createAdminClient()
  const { data: passport, error: passportErr } = await admin
    .from('passports')
    .select('id, passport_uid, title, current_owner_name, current_owner_email, tenant_id')
    .eq('id', passportId)
    .single()

  if (passportErr || !passport) return { success: false, error: 'Passport not found' }
  if (!passport.current_owner_email) return { success: false, error: 'No owner email' }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email')
    .eq('id', passport.tenant_id)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'
  const verificationUrl = `${APP_URL}/verify/${passport.passport_uid}`
  const subject = `Your Jewellery Passport — ${passport.title}`

  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [passport.current_owner_email],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(PassportVerificationEmail, {
      ownerName: passport.current_owner_name || 'Valued Customer',
      itemName: passport.title,
      passportUid: passport.passport_uid,
      verificationUrl,
      issuedBy: businessName,
      businessEmail: tenant?.email ?? null,
    }),
  })
  if (error) return { success: false, error: error.message }
  await logEmail({ tenantId: passport.tenant_id, emailType: 'passport_verification', recipient: passport.current_owner_email, subject, resendId: data?.id, referenceType: 'passport', referenceId: passportId })
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Appointment Confirmation Email
// ─────────────────────────────────────────────────────────────

export async function sendAppointmentConfirmationEmail(params: {
  tenantId: string
  customerName: string
  customerEmail: string
  appointmentType: string
  preferredDate: string
  preferredTime?: string | null
  notes?: string | null
}): Promise<EmailResult> {
  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email, phone, address_line1, suburb, state, postcode')
    .eq('id', params.tenantId)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'
  const businessAddress = tenant
    ? [tenant.address_line1, tenant.suburb, tenant.state, tenant.postcode].filter(Boolean).join(', ')
    : null

  const subject = `Appointment Request Confirmed — ${businessName}`
  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [params.customerEmail],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(AppointmentConfirmationEmail, {
      customerName: params.customerName,
      appointmentType: params.appointmentType,
      preferredDate: params.preferredDate,
      preferredTime: params.preferredTime ?? null,
      businessName,
      businessEmail: tenant?.email ?? null,
      businessPhone: tenant?.phone ?? null,
      businessAddress: businessAddress || null,
      notes: params.notes ?? null,
    }),
  })
  if (error) return { success: false, error: error.message }
  await logEmail({ tenantId: params.tenantId, emailType: 'appointment_confirmation', recipient: params.customerEmail, subject, resendId: data?.id })
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Repair Enquiry Confirmation Email
// ─────────────────────────────────────────────────────────────

export async function sendRepairEnquiryConfirmationEmail(params: {
  tenantId: string
  customerName: string
  customerEmail: string
  itemDescription: string
  repairDescription: string
}): Promise<EmailResult> {
  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email, phone')
    .eq('id', params.tenantId)
    .single()

  const businessName = tenant?.business_name || tenant?.name || 'Your Jeweller'
  const subject = `Repair Enquiry Received — ${businessName}`
  const { data, error } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [params.customerEmail],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject,
    react: createElement(RepairEnquiryConfirmationEmail, {
      customerName: params.customerName,
      itemDescription: params.itemDescription,
      repairDescription: params.repairDescription,
      businessName,
      businessEmail: tenant?.email ?? null,
      businessPhone: tenant?.phone ?? null,
    }),
  })
  if (error) return { success: false, error: error.message }
  await logEmail({ tenantId: params.tenantId, emailType: 'repair_enquiry_confirmation', recipient: params.customerEmail, subject, resendId: data?.id })
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// New Enquiry Notification (internal — to store owner)
// ─────────────────────────────────────────────────────────────

export async function sendNewEnquiryNotificationEmail(params: {
  tenantId: string
  enquiryType: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  message: string
}): Promise<EmailResult> {
  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email')
    .eq('id', params.tenantId)
    .single()

  if (!tenant?.email) return { success: false, error: 'Tenant has no notification email' }
  const businessName = tenant.business_name || tenant.name || 'Your Business'
  const subject = `New ${params.enquiryType} enquiry from ${params.customerName}`

  const { data, error } = await resend.emails.send({
    from: `Nexpura <onboarding@resend.dev>`,
    to: [tenant.email],
    subject,
    react: createElement(NewEnquiryNotificationEmail, {
      businessName,
      enquiryType: params.enquiryType,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone ?? null,
      message: params.message,
      dashboardUrl: `${APP_URL}/enquiries`,
    }),
  })
  if (error) return { success: false, error: error.message }
  await logEmail({ tenantId: params.tenantId, emailType: 'new_enquiry_notification', recipient: tenant.email, subject, resendId: data?.id })
  return { success: true, emailId: data?.id }
}
