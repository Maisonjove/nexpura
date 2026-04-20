/**
 * Generate a placeholder invoice number for a draft invoice created via a
 * repair or bespoke auto-invoice flow. Format: `DRAFT-XXXXXXXX` where X is
 * uppercase hex.
 *
 * Drafts get this placeholder because we don't want to consume a sequence
 * number from the next_invoice_number RPC until the jeweller actually marks
 * the invoice as sent — otherwise every cancelled draft leaves a gap in the
 * official INV-#### sequence. markAsSent() in invoices/actions.ts upgrades
 * the placeholder to the canonical sequential number at send-time.
 *
 * Do not use `Date.now()` directly: the raw millisecond timestamp looks like
 * a leaked internal ID to jewellers (e.g., "DRAFT-1776654441219").
 */
export function generateDraftInvoiceNumber(): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `DRAFT-${hex}`;
}
