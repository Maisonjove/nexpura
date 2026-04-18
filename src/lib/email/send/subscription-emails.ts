import { createElement } from 'react'
import { getResend } from '../resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSystemFromAddress } from '../get-from-address'
import SubscriptionWelcomeEmail from '../templates/SubscriptionWelcomeEmail'
import TrialEndingSoonEmail from '../templates/TrialEndingSoonEmail'
import PaymentSuccessEmail from '../templates/PaymentSuccessEmail'
import PaymentFailedEmail from '../templates/PaymentFailedEmail'
import GracePeriodStartedEmail from '../templates/GracePeriodStartedEmail'
import GracePeriod24hEmail from '../templates/GracePeriod24hEmail'
import AccountSuspendedEmail from '../templates/AccountSuspendedEmail'
import AccountReactivatedEmail from '../templates/AccountReactivatedEmail'
import FreeToPaidConversionEmail from '../templates/FreeToPaidConversionEmail'
import CancellationEmail from '../templates/CancellationEmail'
import { APP_URL, logEmail, EmailResult } from './helpers'

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
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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

  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
    to: [email],
    subject,
    react: createElement(AccountReactivatedEmail, { businessName: name, planName, dashboardUrl: `${APP_URL}/dashboard` }),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, emailId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// Free To Paid Conversion Email
// ─────────────────────────────────────────────────────────────

export async function sendFreeToPaidConversionEmail(email: string, name: string, deadline: string): Promise<EmailResult> {
  const subject = `Payment required for your Nexpura account`
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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
  const { data, error } = await getResend().emails.send({
    from: getSystemFromAddress('nexpura'),
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
