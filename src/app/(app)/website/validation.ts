// Client-safe validation utilities for the website builder
// These are NOT server actions - they can be used in both client and server contexts

/**
 * Validate a page name
 */
export function validatePageName(name: string): { valid: boolean; error?: string } {
  const trimmed = name?.trim() ?? "";
  
  if (!trimmed) {
    return { valid: false, error: "Page name is required" };
  }
  
  if (trimmed.length < 2) {
    return { valid: false, error: "Page name must be at least 2 characters" };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: "Page name must be 100 characters or less" };
  }
  
  return { valid: true };
}

/**
 * Validate a URL
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  const trimmed = url?.trim() ?? "";
  
  if (!trimmed) {
    return { valid: true }; // URLs are often optional
  }
  
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "URL must start with http:// or https://" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Please enter a valid URL" };
  }
}

/**
 * Validate an email address
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email?.trim() ?? "";
  
  if (!trimmed) {
    return { valid: true }; // Emails are often optional
  }
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address" };
  }
  
  return { valid: true };
}

/**
 * Validate a phone number
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const trimmed = phone?.trim() ?? "";
  
  if (!trimmed) {
    return { valid: true }; // Phone numbers are often optional
  }
  
  // Remove common separators for validation
  const cleaned = trimmed.replace(/[\s\-\(\)\.]/g, "");
  
  // Check for valid phone number pattern (with or without country code)
  const phoneRegex = /^\+?[0-9]{6,15}$/;
  if (!phoneRegex.test(cleaned)) {
    return { valid: false, error: "Please enter a valid phone number" };
  }
  
  return { valid: true };
}

/**
 * Sanitize text content (strip potential XSS)
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  // Remove script tags and event handlers
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "");
}
