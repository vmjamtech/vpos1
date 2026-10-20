import {
  buildSizeIncentiveBreakdown,
  normalizeSizeKey,
  STANDARD_INCENTIVE_SIZES,
} from './personnel-rates.constants';

describe('personnel incentive sizes', () => {
  it('uses the canonical size list and normalizes casing and whitespace', () => {
    expect(STANDARD_INCENTIVE_SIZES).toEqual([
      'No Size',
      '2.7kg',
      '3kg',
      '5kg',
      '7kg',
      '11kg',
      '15kg',
      '22kg',
      '50kg',
    ]);
    expect(normalizeSizeKey(' 3 KG ')).toBe('3kg');
    expect(normalizeSizeKey(null)).toBe('No Size');
  });

  it('calculates each standard size and excludes 250g from No Size', () => {
    const result = buildSizeIncentiveBreakdown(
      [
        { size: '3 KG', qty: 4 },
        { size: null, qty: 2 },
        { size: '250grams', qty: 100 },
      ],
      { 'No Size': 7, '3kg': 2 }
    );

    expect(result.totalIncentive).toBe(22);
    expect(result.breakdown).toEqual([
      { size: 'No Size', qty: 2, rate: 7, amount: 14 },
      { size: '2.7kg', qty: 0, rate: 0, amount: 0 },
      { size: '3kg', qty: 4, rate: 2, amount: 8 },
      { size: '5kg', qty: 0, rate: 0, amount: 0 },
      { size: '7kg', qty: 0, rate: 0, amount: 0 },
      { size: '11kg', qty: 0, rate: 0, amount: 0 },
      { size: '15kg', qty: 0, rate: 0, amount: 0 },
      { size: '22kg', qty: 0, rate: 0, amount: 0 },
      { size: '50kg', qty: 0, rate: 0, amount: 0 },
    ]);
  });
});
