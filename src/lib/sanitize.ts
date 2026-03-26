import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content, allowing only safe formatting tags
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
  });
}

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
