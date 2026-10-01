import {
  getTodayDateRange,
  normalizeDatePickerValue,
  sqliteInclusiveDateRange,
  toLocalDateString,
} from './date-range';

describe('date-range helpers', () => {
  it('formats the device-local calendar date without UTC conversion', () => {
    expect(toLocalDateString(new Date(2026, 8, 25, 12))).toBe('2026-09-25');
  });

  it('initializes both range ends to the current local date', () => {
    expect(getTodayDateRange(new Date(2026, 8, 25, 12))).toEqual({
      dateFrom: '2026-09-25',
      dateTo: '2026-09-25',
    });
  });

  it('normalizes date picker values while preserving the selected date', () => {
    expect(normalizeDatePickerValue('2026-09-25T00:00:00.000Z')).toBe(
      '2026-09-25'
    );
    expect(normalizeDatePickerValue('', '2026-09-25')).toBe('2026-09-25');
  });

  it('uses inclusive calendar-day comparisons for timestamp columns', () => {
    expect(sqliteInclusiveDateRange('dtdate')).toBe(
      'DATE(dtdate) >= DATE(?) AND DATE(dtdate) <= DATE(?)'
    );
  });
});
