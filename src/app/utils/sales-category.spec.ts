import { normalizeSalesCategory } from './sales-category';

describe('normalizeSalesCategory', () => {
  it('normalizes legacy and current fulfillment labels', () => {
    expect(normalizeSalesCategory('1-PICK UP')).toBe('PICK UP');
    expect(normalizeSalesCategory('PICK UP')).toBe('PICK UP');
    expect(normalizeSalesCategory('2-DELIVERY')).toBe('DELIVERY');
    expect(normalizeSalesCategory('DELIVERY')).toBe('DELIVERY');
  });

  it('keeps unknown categories and defaults missing values to pickup', () => {
    expect(normalizeSalesCategory('Other')).toBe('Other');
    expect(normalizeSalesCategory(null)).toBe('PICK UP');
  });
});
