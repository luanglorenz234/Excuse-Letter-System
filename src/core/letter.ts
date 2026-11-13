/**
 * The words of the 2026 "Notice of Absence" letter, as plain data, so the
 * React letter only lays them out. Interns and employees each have a format
 * (HR's NEW FORMATTING samples): the request's memberType picks it.
 */

import { addDaysYmd, countWeekdays, parseLocalDate, toYmd, todayYmd } from './dates';
import { DEFAULT_TIME_RANGE, isGroupRequest } from './requests';
import type { AbsenceRequest, FormatWording, LetterSettings } from './types';

/** "November 05, 2026": the new letters pad the day. */
export function formatLetterDate(ymd: string | null | undefined): string {
  const dt = parseLocalDate(ymd);
  if (!dt) return '{DATE}';
  const month = dt.toLocaleDateString('en-US', { month: 'long' });
  return `${month} ${String(dt.getDate()).padStart(2, '0')}, ${dt.getFullYear()}`;
}

/** "Friday, November 06, 2026" */
export function formatLetterDay(ymd: string | null | undefined): string {
  const dt = parseLocalDate(ymd);
  if (!dt) return '{DATE}';
  return `${dt.toLocaleDateString('en-US', { weekday: 'long' })}, ${formatLetterDate(ymd)}`;
}

/** The date at the top of the letter: the day it was submitted (local time), or created, or today. */
export function letterDateYmd(req: Pick<AbsenceRequest, 'submittedAt' | 'createdAt'>, now: Date = new Date()): string {
  const iso = req.submittedAt ?? req.createdAt;
  if (!iso) return todayYmd(now);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? todayYmd(now) : toYmd(dt);
}

export function wordingFor(req: Pick<AbsenceRequest, 'memberType'>, settings: LetterSettings): FormatWording {
  return settings.formats[req.memberType === 'employee' ? 'employee' : 'intern'];
}

/** A run of letter text. `typed` came from the form (the preview marks it); `placeholder` stands in for something not filled in yet. */
export interface Segment {
  readonly text: string;
  readonly typed?: boolean;
  readonly placeholder?: boolean;
}

/** Words a reason may start with that read wrong capitalised after "as". Names and "I" keep their capital. */
const LOWERCASE_STARTERS = new Set([
  'my', 'our', 'we', 'the', 'a', 'an', 'there', 'this', 'that', 'it', 'these', 'those',
  'his', 'her', 'their', 'today', 'tomorrow', 'both', 'all', 'each', 'some', 'one',
]);

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * The reason as it continues the opening sentence: "as I have a meeting with
 * our department chairperson … on the said date." Members write it as a
 * sentence; this joins it on, so "Our department is…" becomes "as our
 * department is…", and one that already starts with "because" keeps it.
 */
export function reasonClause(reason: string): string | null {
  const r = reason.trim().replace(/\s+/g, ' ');
  if (!r) return null;
  const ended = /[.!?]["'”’)]*$/.test(r) ? r : `${r}.`;
  if (/^(as|because|since|due to)\b/i.test(ended)) return lowerFirst(ended);
  const first = (ended.split(/[\s,]/)[0] ?? '').toLowerCase();
  return `as ${LOWERCASE_STARTERS.has(first) ? lowerFirst(ended) : ended}`;
}

/**
 * The first paragraph: the request, the date(s) and the reason in one sentence.
 *   Intern:   "I am respectfully requesting permission to take a leave of absence on Tuesday, October 27, 2026 as …"
 *   Employee: "I am writing to respectfully request permission to be absent from work tomorrow, Friday, November 06, 2026, as …"
 */
export function openingSegments(req: AbsenceRequest, letterYmd: string): Segment[] {
  const employee = req.memberType === 'employee';
  const we = isGroupRequest(req);
  const out: Segment[] = [];
  const t = (text: string) => out.push({ text });
  const v = (text: string) => out.push({ text, typed: true });

  t(
    employee
      ? `${we ? 'We are' : 'I am'} writing to respectfully request permission to be absent from work `
      : `${we ? 'We are' : 'I am'} respectfully requesting permission to take a leave of absence `,
  );

  if (req.type === 'half') {
    const shift = req.shift ?? 'morning';
    t('on the ');
    v(shift);
    t(' of ');
    v(formatLetterDay(req.date));
    t(' (');
    v(req.timeRange || DEFAULT_TIME_RANGE[shift]);
    t(')');
  } else if (req.type === 'multi') {
    const n = req.startDate && req.endDate ? countWeekdays(req.startDate, req.endDate) : req.days;
    const days = `${n} ${n === 1 ? 'day' : 'days'}`;
    if (employee) {
      // "absent from work for 3 days, from Monday … to Wednesday …"
      t('for ');
      v(days);
      t(', from ');
      v(formatLetterDay(req.startDate));
      t(' to ');
      v(formatLetterDay(req.endDate));
    } else {
      t('from ');
      v(formatLetterDay(req.startDate));
      t(' to ');
      v(formatLetterDay(req.endDate));
      t(' (');
      v(days);
      t(')');
    }
  } else if (employee && req.date && req.date === addDaysYmd(letterYmd, 1)) {
    t('tomorrow, ');
    v(formatLetterDay(req.date));
  } else {
    t('on ');
    v(formatLetterDay(req.date));
  }

  t(employee ? ', ' : ' ');
  const clause = reasonClause(req.reasonDetails);
  if (clause) v(clause);
  else out.push({ text: 'as [the reason for the absence, 30 to 400 characters].', placeholder: true });
  return out;
}

/** The whole opening as text: what the letter says, for tests and anything that needs it unstyled. */
export function openingText(req: AbsenceRequest, letterYmd: string): string {
  return openingSegments(req, letterYmd)
    .map((s) => s.text)
    .join('');
}
