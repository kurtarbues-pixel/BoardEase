export const BUSINESS_TIME_ZONE = 'Asia/Manila';

function parts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, ...options }).formatToParts(date).map(({ type, value }) => [type, value]));
}

export function getTodayDateString(now: Date = new Date()): string {
  const value = parts(now, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${value.year}-${value.month}-${value.day}`;
}

export function getCurrentMonthString(now: Date = new Date()): string {
  const value = parts(now, { year: 'numeric', month: '2-digit' });
  return `${value.year}-${value.month}`;
}

function parseDate(value: string): Date {
  // Date-only API values represent Philippine calendar dates, not UTC instants.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+08:00`) : new Date(value);
}

export function formatBusinessDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }): string {
  if (!value) return '—';
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-PH', { ...options, timeZone: BUSINESS_TIME_ZONE }).format(date);
}

export function formatBusinessDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: BUSINESS_TIME_ZONE }).format(date);
}

export function getBusinessWeekday(value: string): string {
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: BUSINESS_TIME_ZONE }).format(date);
}

export function getBusinessDayOfMonth(value: string): number {
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? 0 : Number(new Intl.DateTimeFormat('en-CA', { day: 'numeric', timeZone: BUSINESS_TIME_ZONE }).format(date));
}
