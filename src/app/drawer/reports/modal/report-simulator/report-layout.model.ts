export type ReportLayoutTab =
  | 'summary'
  | 'item-sold'
  | 'inventory'
  | 'floorstock';

export type ReportTextAlignment = 'left' | 'center' | 'right';

export interface ReportColumnConfig {
  id: number;
  name: string;
  headWidth: number;
  headAlign: ReportTextAlignment;
  sample: string;
  valueWidth: number;
  valueAlign: ReportTextAlignment;
}

export interface ReportLayoutConfig {
  tabKey: ReportLayoutTab;
  totalWidth: number;
  fontMode: 'Font A' | 'Font B';
  headingFontSize: 'normal' | 'double-height' | 'bold';
  valueFontSize: 'normal' | 'condensed';
  feedCount: number;
  columns: ReportColumnConfig[];
}

export function getDefaultReportLayoutConfig(
  tab: ReportLayoutTab
): ReportLayoutConfig {
  const columns: Record<ReportLayoutTab, ReportColumnConfig[]> = {
    summary: [
      { id: 1, name: 'DESCRIPTION', headWidth: 22, headAlign: 'left', sample: 'Total Sales', valueWidth: 22, valueAlign: 'left' },
      { id: 2, name: 'AMOUNT', headWidth: 10, headAlign: 'right', sample: '1,250.00', valueWidth: 10, valueAlign: 'right' },
    ],
    'item-sold': [
      { id: 1, name: 'CODE', headWidth: 8, headAlign: 'left', sample: 'ABC123', valueWidth: 8, valueAlign: 'left' },
      { id: 2, name: 'SIZE', headWidth: 14, headAlign: 'left', sample: '11 KG REFILL', valueWidth: 14, valueAlign: 'left' },
      { id: 3, name: 'Total QTY', headWidth: 10, headAlign: 'right', sample: '120', valueWidth: 10, valueAlign: 'right' },
    ],
    inventory: [
      { id: 1, name: 'CODE', headWidth: 12, headAlign: 'left', sample: 'ABC123', valueWidth: 12, valueAlign: 'left' },
      { id: 2, name: 'FILLED', headWidth: 10, headAlign: 'right', sample: '120', valueWidth: 10, valueAlign: 'right' },
      { id: 3, name: 'EMPTY', headWidth: 10, headAlign: 'right', sample: '8', valueWidth: 10, valueAlign: 'right' },
    ],
    floorstock: [
      { id: 1, name: 'CODE', headWidth: 8, headAlign: 'left', sample: 'ABC123', valueWidth: 8, valueAlign: 'left' },
      { id: 2, name: 'FILL', headWidth: 8, headAlign: 'right', sample: '120', valueWidth: 8, valueAlign: 'right' },
      { id: 3, name: 'STOCK', headWidth: 8, headAlign: 'right', sample: '24', valueWidth: 8, valueAlign: 'right' },
      { id: 4, name: 'NEED', headWidth: 8, headAlign: 'right', sample: '6', valueWidth: 8, valueAlign: 'right' },
    ],
  };

  return {
    tabKey: tab,
    totalWidth: 32,
    fontMode: 'Font A',
    headingFontSize: 'normal',
    valueFontSize: 'normal',
    feedCount: 3,
    columns: columns[tab].map((column) => ({ ...column })),
  };
}

export function readReportLayoutConfig(tab: ReportLayoutTab): ReportLayoutConfig {
  const defaults = getDefaultReportLayoutConfig(tab);
  if (typeof localStorage === 'undefined') return defaults;

  try {
    const stored = localStorage.getItem(`report_layout_${tab}`);
    if (!stored) return defaults;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object') return defaults;

    const config = value as Partial<ReportLayoutConfig>;
    const valid =
      config.tabKey === tab &&
      Number.isFinite(config.totalWidth) &&
      config.totalWidth! >= 16 &&
      config.totalWidth! <= 48 &&
      (config.fontMode === 'Font A' || config.fontMode === 'Font B') &&
      ['normal', 'double-height', 'bold'].includes(config.headingFontSize ?? '') &&
      ['normal', 'condensed'].includes(config.valueFontSize ?? '') &&
      (config.feedCount === undefined ||
        (Number.isInteger(config.feedCount) && config.feedCount >= 0 && config.feedCount <= 10)) &&
      Array.isArray(config.columns) &&
      config.columns.length > 0 &&
      config.columns.length <= 10 &&
      config.columns.every((column) =>
        Number.isFinite(column.id) &&
        typeof column.name === 'string' &&
        typeof column.sample === 'string' &&
        Number.isFinite(column.headWidth) &&
        column.headWidth >= 0 &&
        column.headWidth <= 48 &&
        Number.isFinite(column.valueWidth) &&
        column.valueWidth >= 0 &&
        column.valueWidth <= 48 &&
        ['left', 'center', 'right'].includes(column.headAlign) &&
        ['left', 'center', 'right'].includes(column.valueAlign)
      );
    return valid
      ? ({ ...config, feedCount: config.feedCount ?? defaults.feedCount } as ReportLayoutConfig)
      : defaults;
  } catch (error) {
    console.warn('Could not read report layout settings:', error);
    return defaults;
  }
}