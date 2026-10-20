import { normalizeItemSize } from './item-size.pipe';

describe('normalizeItemSize', () => {
  it('uses No Size for missing, blank, whitespace, and placeholder values', () => {
    expect(normalizeItemSize(null)).toBe('No Size');
    expect(normalizeItemSize(undefined)).toBe('No Size');
    expect(normalizeItemSize('')).toBe('No Size');
    expect(normalizeItemSize('  ')).toBe('No Size');
    expect(normalizeItemSize(' Select Size ')).toBe('No Size');
  });

  it('preserves valid sizes after trimming whitespace', () => {
    expect(normalizeItemSize(' 11kg ')).toBe('11kg');
  });
});
