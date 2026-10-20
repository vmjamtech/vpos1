export const STANDARD_INCENTIVE_SIZES = [
  'No Size',
  '2.7kg',
  '3kg',
  '5kg',
  '7kg',
  '11kg',
  '15kg',
  '22kg',
  '50kg',
] as const;

export interface SizeIncentiveBreakdownLine {
  size: (typeof STANDARD_INCENTIVE_SIZES)[number];
  qty: number;
  rate: number;
  amount: number;
}

export function normalizeSizeKey(
  rawSize: string | null | undefined
): (typeof STANDARD_INCENTIVE_SIZES)[number] {
  const clean = (rawSize ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!clean) return 'No Size';

  return (
    STANDARD_INCENTIVE_SIZES.find(
      (size) => size.toLowerCase().replace(/\s+/g, '') === clean
    ) ?? 'No Size'
  );
}

export function buildSizeIncentiveBreakdown(
  aggregatedRows: Array<{ size: string | null; qty: number }>,
  configuredRates: Record<string, number>
): { breakdown: SizeIncentiveBreakdownLine[]; totalIncentive: number } {
  const quantities = new Map<string, number>();
  aggregatedRows.forEach((row) => {
    const rawSize = String(row.size ?? '').trim();
    if (/^250\s*(?:g|grams?)$/i.test(rawSize.replace(/\s+/g, ''))) return;
    const size = normalizeSizeKey(rawSize);
    quantities.set(
      size,
      (quantities.get(size) ?? 0) + (Number(row.qty) || 0)
    );
  });

  const breakdown = STANDARD_INCENTIVE_SIZES.map((size) => {
    const qty = quantities.get(size) ?? 0;
    const rate = Number(configuredRates[size] ?? 0) || 0;
    return { size, qty, rate, amount: qty * rate };
  });

  return {
    breakdown,
    totalIncentive: breakdown.reduce((total, line) => total + line.amount, 0),
  };
}
