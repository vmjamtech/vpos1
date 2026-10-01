export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateRange(date: Date = new Date()): DateRange {
  const today = toLocalDateString(date);
  return { dateFrom: today, dateTo: today };
}

export function normalizeDatePickerValue(
  value: string | null | undefined,
  fallback: string = toLocalDateString()
): string {
  const date = value?.trim().split('T')[0];
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback;
}

export function sqliteInclusiveDateRange(column: string): string {
  return `DATE(${column}) >= DATE(?) AND DATE(${column}) <= DATE(?)`;
}
