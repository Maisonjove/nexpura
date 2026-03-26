import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../format-currency';

describe('formatCurrency', () => {
  it('formats amount with default AUD currency', () => {
    const result = formatCurrency(100);
    expect(result).toContain('100');
    expect(result).toContain('$');
  });

  it('formats amount with specified currency', () => {
    const result = formatCurrency(50.5, 'USD');
    expect(result).toContain('50');
  });

  it('handles zero amounts', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('handles negative amounts', () => {
    const result = formatCurrency(-25.99);
    expect(result).toContain('25.99');
  });

  it('formats with two decimal places', () => {
    const result = formatCurrency(100.1);
    expect(result).toContain('100.10');
  });

  it('falls back to AUD when currency is null', () => {
    const result = formatCurrency(50, null);
    expect(result).toContain('$');
  });

  it('falls back to AUD when currency is undefined', () => {
    const result = formatCurrency(50, undefined);
    expect(result).toContain('$');
  });

  it('handles large numbers', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('1,000,000');
  });
});
