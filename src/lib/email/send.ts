/**
 * Email Send Functions
 * 
 * This file re-exports all email functions from the modular send/ directory.
 * The functionality has been split into:
 * - send/helpers.ts - Common utilities (APP_URL, logEmail, EmailResult)
 * - send/customer-emails.ts - Customer-facing emails
 * - send/subscription-emails.ts - Billing/subscription emails
 * - send/notification-emails.ts - Internal notifications and alerts
 * 
 * @module email/send
 */

// Re-export everything from the modular structure
export * from './send/index';
