// Note: this module is server-shared. Importing `isomorphic-dompurify`
// here pulls jsdom + html-encoding-sniffer + the ESM-only @exodus/bytes
// into every server file that just wants `escapeHtml`, which on Vercel's
// runtime crashes with ERR_REQUIRE_ESM at first use (digest 2717347054).
// The only consumer of DOM-based sanitization in the codebase is client-
// side preview rendering — those files import `isomorphic-dompurify`
// directly themselves. Server-side callers only ever needed the pure-
// string helpers below, so DOMPurify-backed `sanitizeHtml` was removed.

/**
 * Sanitize plain text by removing potential HTML/script injection characters
 */
export function sanitizeText(input: string): string {
  return input.replace(/[<>]/g, '');
}

/**
 * Sanitize user input for database storage
 * Removes null bytes and trims whitespace
 */
export function sanitizeForDb(input: string): string {
  return input
    .replace(/\0/g, '') // Remove null bytes
    .trim();
}

/**
 * Escape HTML entities for safe display
 */
export function escapeHtml(input: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return input.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}
