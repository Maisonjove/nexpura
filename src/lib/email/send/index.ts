/**
 * Email Send Functions
 * 
 * This module provides all email sending functions organized by category:
 * - Customer emails: invoices, repairs, quotes, passports
 * - Subscription emails: billing, payments, account status
 * - Notification emails: invites, alerts, enquiries, support
 */

// Re-export types
export type { EmailResult } from './helpers';

// Re-export customer-facing email functions
export {
  sendInvoiceEmail,
  sendJobReadyEmail,
  sendRepairReadyEmail,
  sendQuoteEmail,
  sendPassportEmail,
  sendRepairReceivedEmail,
  sendPassportVerificationEmail,
} from './customer-emails';

// Re-export subscription/billing email functions
export {
  sendSubscriptionWelcomeEmail,
  sendTrialEndingSoonEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendGracePeriodStartedEmail,
  sendGracePeriod24hEmail,
  sendAccountSuspendedEmail,
  sendAccountReactivatedEmail,
  sendFreeToPaidConversionEmail,
  sendCancellationEmail,
} from './subscription-emails';

// Re-export notification email functions
export {
  sendUserInvitedEmail,
  sendLowStockAlertEmail,
  sendAppointmentConfirmationEmail,
  sendRepairEnquiryConfirmationEmail,
  sendNewEnquiryNotificationEmail,
  sendSupportAccessRequestEmail,
  sendSupportAccessApprovedEmail,
} from './notification-emails';
