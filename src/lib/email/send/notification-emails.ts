import { createElement } from 'react'
import { resend } from '../resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFromAddress, getSystemFromAddress } from '../get-from-address'
import UserInvitedEmail from '../templates/UserInvitedEmail'
import LowStockAlertEmail from '../templates/LowStockAlertEmail'
import AppointmentConfirmationEmail from '../templates/AppointmentConfirmationEmail'
import RepairEnquiryConfirmationEmail from '../templates/RepairEnquiryConfirmationEmail'
import NewEnquiryNotificationEmail from '../templates/NewEnquiryNotificationEmail'
import SupportAccessRequestEmail from '../templates/SupportAccessRequestEmail'
import SupportAccessApprovedEmail from '../templates/SupportAccessApprovedEmail'
import { APP_URL, logEmail, EmailResult } from './helpers'

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
    from: getSystemFromAddress('nexpura'),
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

export async function sendLowStockAlertEmail(
  email: string,
  businessName: string,
  items: Array<{ name: string; sku: string; quantity: number }>,
  inventoryUrl: string,
  tenantId?: string
): Promise<EmailResult> {
  const subject = `Low stock alert — ${items.length} item${items.length === 1 ? '' : 's'} need attention`
  
  const fromAddress = tenantId 
    ? await getFromAddress(tenantId, "notifications")
    : { from: `${businessName} <notifications@nexpura.com>` };
  
  const { data, error } = await resend.emails.send({
    from: fromAddress.from,
    to: [email],
    subject,
    react: createElement(LowStockAlertEmail, { businessName, items, inventoryUrl }),
  })
  if (error) return { success: false, error: error.message }
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
  
  const emailConfig = await getFromAddress(params.tenantId, "notifications");
  
  const { data, error } = await resend.emails.send({
    from: emailConfig.from,
    to: [params.customerEmail],
    replyTo: emailConfig.replyTo ? [emailConfig.replyTo] : (tenant?.email ? [tenant.email] : undefined),
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
  
  const emailConfig = await getFromAddress(params.tenantId, "notifications");
  
  const { data, error } = await resend.emails.send({
    from: emailConfig.from,
    to: [params.customerEmail],
    replyTo: emailConfig.replyTo ? [emailConfig.replyTo] : (tenant?.email ? [tenant.email] : undefined),
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
    from: getSystemFromAddress('nexpura'),
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

// ─────────────────────────────────────────────────────────────
// Support Access Request Email
// ─────────────────────────────────────────────────────────────

export async function sendSupportAccessRequestEmail(params: {
  tenantId: string
  tenantEmail: string
  businessName: string
  reason: string | null
  token: string
}): Promise<EmailResult> {
  const approveUrl = `${APP_URL}/support-access/approve/${params.token}`
  const denyUrl = `${APP_URL}/support-access/deny/${params.token}`
  const subject = `Nexpura Support Access Request`

  const { data, error } = await resend.emails.send({
    from: getSystemFromAddress('support'),
    to: [params.tenantEmail],
    subject,
    react: createElement(SupportAccessRequestEmail, {
      businessName: params.businessName,
      reason: params.reason,
      approveUrl,
      denyUrl,
    }),
  })

  if (error) return { success: false, error: error.message }
  await logEmail({
    tenantId: params.tenantId,
    emailType: 'support_access_request',
    recipient: params.tenantEmail,
    subject,
    resendId: data?.id,
  })
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Support Access Approved Email (to super admin)
// ─────────────────────────────────────────────────────────────

export async function sendSupportAccessApprovedEmail(params: {
  superAdminEmail: string
  businessName: string
  expiresAt: string
  tenantId: string
}): Promise<EmailResult> {
  const dashboardUrl = `${APP_URL}/admin`
  const subject = `Support Access Approved — ${params.businessName}`

  const { data, error } = await resend.emails.send({
    from: getSystemFromAddress('nexpura'),
    to: [params.superAdminEmail],
    subject,
    react: createElement(SupportAccessApprovedEmail, {
      businessName: params.businessName,
      expiresAt: params.expiresAt,
      dashboardUrl,
    }),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}
