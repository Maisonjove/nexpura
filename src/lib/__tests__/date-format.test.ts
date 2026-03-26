import { describe, it, expect } from 'vitest';
import { formatDate, formatRelative, formatCurrency } from '../date-format';

describe('formatDate', () => {
  it('formats a valid Date object', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatDate(date);
    expect(result).toBe('15 Jan 2024');
  });

  it('formats a valid date string', () => {
    const result = formatDate('2024-06-20T00:00:00Z');
    expect(result).toBe('20 Jun 2024');
  });

  it('returns dash for null date', () => {
    const result = formatDate(null);
    expect(result).toBe('—');
  });

  it('returns dash for undefined date', () => {
    const result = formatDate(undefined);
    expect(result).toBe('—');
  });

  it('returns dash for invalid date string', () => {
    const result = formatDate('not-a-date');
    expect(result).toBe('—');
  });

  it('uses custom format string', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatDate(date, 'yyyy-MM-dd');
    expect(result).toBe('2024-01-15');
  });

  it('respects locale parameter for French', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatDate(date, 'dd MMMM yyyy', 'fr');
    expect(result).toContain('janvier');
  });

  it('respects locale parameter for Spanish', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatDate(date, 'dd MMMM yyyy', 'es');
    expect(result).toContain('enero');
  });
});

describe('formatRelative', () => {
  it('returns dash for null date', () => {
    const result = formatRelative(null);
    expect(result).toBe('—');
  });

  it('returns dash for undefined date', () => {
    const result = formatRelative(undefined);
    expect(result).toBe('—');
  });

  it('returns dash for invalid date', () => {
    const result = formatRelative('invalid');
    expect(result).toBe('—');
  });

  it('formats recent dates with "ago" suffix', () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    const result = formatRelative(recentDate);
    expect(result).toContain('ago');
  });

  it('accepts date strings', () => {
    const dateStr = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(); // 1 day ago
    const result = formatRelative(dateStr);
    expect(result).toContain('ago');
  });
});

describe('formatCurrency (from date-format)', () => {
  it('formats amount with default currency', () => {
    const result = formatCurrency(100);
    expect(result).toContain('100');
  });

  it('returns dash for null amount', () => {
    const result = formatCurrency(null);
    expect(result).toBe('—');
  });

  it('returns dash for undefined amount', () => {
    const result = formatCurrency(undefined);
    expect(result).toBe('—');
  });

  it('formats with specified currency', () => {
    const result = formatCurrency(50, 'EUR');
    expect(result).toContain('50');
  });

  it('uses French locale formatting', () => {
    const result = formatCurrency(1000, 'EUR', 'fr');
    expect(result).toBeDefined();
  });

  it('handles zero values', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });
});
