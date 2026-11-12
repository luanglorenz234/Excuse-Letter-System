/** Dates as `yyyy-mm-dd` strings in local time, the way the form and the slots use them. */

export function parseLocalDate(ymd: string | null | undefined): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function toYmd(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayYmd(now: Date = new Date()): string {
  return toYmd(now);
}

export function addDaysYmd(ymd: string, n: number): string {
  const dt = parseLocalDate(ymd) ?? new Date();
  dt.setDate(dt.getDate() + n);
  return toYmd(dt);
}

export function currentYear(now: Date = new Date()): string {
  return String(now.getFullYear());
}

/** The earliest date a request may cover: 7 days back from today. */
export function minFilingDate(now: Date = new Date()): string {
  return addDaysYmd(todayYmd(now), -7);
}

/** "Thursday, November 12, 2026" */
export function formatLongDate(ymd: string | null | undefined): string {
  const dt = parseLocalDate(ymd);
  if (!dt) return '{DATE}';
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** "November 12, 2026" */
export function formatStandardDate(ymd: string | null | undefined): string {
  const dt = parseLocalDate(ymd);
  if (!dt) return '{DATE}';
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "Nov 12, 2026", from a date or a full timestamp. */
export function formatShortDate(isoOrYmd: string | null | undefined): string {
  if (!isoOrYmd) return '—';
  const dt = isoOrYmd.length === 10 ? parseLocalDate(isoOrYmd) : new Date(isoOrYmd);
  if (!dt || Number.isNaN(dt.getTime())) return isoOrYmd;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isWeekday(dt: Date): boolean {
  const day = dt.getDay();
  return day !== 0 && day !== 6;
}

/** Every Monday to Friday from start to end, inclusive. */
export function weekdaysBetween(startYmd: string | null, endYmd: string | null): string[] {
  const start = parseLocalDate(startYmd);
  const end = parseLocalDate(endYmd);
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (isWeekday(cur)) dates.push(toYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function countWeekdays(startYmd: string | null, endYmd: string | null): number {
  return weekdaysBetween(startYmd, endYmd).length;
}
