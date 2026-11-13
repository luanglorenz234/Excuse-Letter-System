import { describe, expect, it } from 'vitest';
import { saveLetterSettings } from './settings';
import { DEFAULT_NOTED_BY, normalizeSettings } from './db';
import { formatLetterDate, letterDateYmd, notedByFor, openingText, reasonClause, signsInApp, wordingFor } from './letter';
import { buildDraft, inputFrom } from './requests';
import { seedDb } from './seed';
import { LETTER_FORMAT_VERSION, type AbsenceRequest, type GroupMember, type MemberType } from './types';

const NOW = new Date(2026, 9, 26, 9, 0, 0);

/** A letter from the absence form, as an intern or an employee. */
function request(memberType: MemberType, over: Partial<ReturnType<typeof inputFrom>>): AbsenceRequest {
  const position = memberType === 'employee' ? 'IT Administrator' : '';
  const input = { ...inputFrom(null, '2026-10-27', '2026-10-28', memberType), name: 'Juan Dela Cruz', position, department: 'IT', ...over };
  return buildDraft(input, null, NOW);
}

describe('the 2026 letter wording', () => {
  it('pads the day like the new letters: "November 05, 2026"', () => {
    expect(formatLetterDate('2026-11-05')).toBe('November 05, 2026');
    expect(formatLetterDate('2026-10-26')).toBe('October 26, 2026');
  });

  it('dates the letter by the local day it was submitted', () => {
    expect(letterDateYmd({ submittedAt: new Date(2026, 10, 5, 0, 30).toISOString(), createdAt: '' })).toBe('2026-11-05');
  });

  it('intern opening reads like the intern sample', () => {
    const req = request('intern', { date: '2026-10-27', reasonDetails: 'I have a meeting with our department chairperson for our capstone project on the said date.' });
    expect(openingText(req, '2026-10-26')).toBe(
      'I am respectfully requesting permission to take a leave of absence on Tuesday, October 27, 2026 as I have a meeting with our department chairperson for our capstone project on the said date.',
    );
  });

  it('employee opening reads like the employee sample, "tomorrow" included', () => {
    const req = request('employee', {
      date: '2026-11-06',
      reasonDetails: 'I am required to attend an activity for one of my subjects that requires my face-to-face presence at school.',
    });
    expect(openingText(req, '2026-11-05')).toBe(
      'I am writing to respectfully request permission to be absent from work tomorrow, Friday, November 06, 2026, as I am required to attend an activity for one of my subjects that requires my face-to-face presence at school.',
    );
    expect(openingText(req, '2026-11-02')).toContain('absent from work on Friday, November 06, 2026, as I am required');
  });

  it('half days and several days name the shift or the range', () => {
    const half = request('intern', { type: 'half', date: '2026-10-27', shift: 'afternoon', timeRange: '1:00 PM – 5:00 PM', reasonDetails: 'I have a dental appointment that afternoon.' });
    expect(openingText(half, '2026-10-26')).toContain('on the afternoon of Tuesday, October 27, 2026 (1:00 PM – 5:00 PM) as I have');
    const multi = request('intern', { type: 'multi', startDate: '2026-10-27', endDate: '2026-10-29', reasonDetails: 'I have to attend our school retreat.' });
    expect(openingText(multi, '2026-10-26')).toContain('from Tuesday, October 27, 2026 to Thursday, October 29, 2026 (3 days) as I have');
    const employeeMulti = request('employee', { type: 'multi', startDate: '2026-10-27', endDate: '2026-10-29', reasonDetails: 'I have to attend our school retreat.' });
    expect(openingText(employeeMulti, '2026-10-26')).toContain(
      'absent from work for 3 days, from Tuesday, October 27, 2026 to Thursday, October 29, 2026, as I have',
    );
  });

  it('a group letter speaks as "we"', () => {
    const other: GroupMember = { uid: null, name: 'Kevs Reyes', internId: '', position: 'Intern', department: '', memberType: 'intern', signature: '' };
    const req = request('intern', { groupMode: true, groupMembers: [other], reasonDetails: 'We have our capstone defense at the university.' });
    expect(openingText(req, '2026-10-26')).toMatch(/^We are respectfully requesting .* as we have our capstone defense at the university\.$/);
  });

  it('joins the reason onto the sentence', () => {
    expect(reasonClause('Our department is holding a seminar')).toBe('as our department is holding a seminar.');
    expect(reasonClause('Because my mother is in the hospital.')).toBe('because my mother is in the hospital.');
    expect(reasonClause('Dr. Santos asked me to come in for tests.')).toBe('as Dr. Santos asked me to come in for tests.');
    expect(reasonClause('   ')).toBeNull();
  });

  it('picks the format by member type', () => {
    const s = seedDb().settings.letter;
    expect(wordingFor({ memberType: 'intern' }).closing).toBe('Respectfully,');
    expect(wordingFor({ memberType: 'employee' }).closing).toBe('Very respectfully yours,');
    expect(notedByFor({ memberType: 'employee' }, s).map((n) => n.title)).toEqual(['CEO', 'HR Officer', 'HR / Marketing Officer']);
    expect(notedByFor({ memberType: 'intern' }, s).map((n) => n.title)).toEqual(['HR Officer']);
  });

  it('only the HR officer signs in the app; the CEO and Marketing sign the printed copy', () => {
    const s = seedDb().settings.letter;
    expect(notedByFor({ memberType: 'employee' }, s).map((n) => signsInApp(n, s))).toEqual([false, true, false]);
  });
});

describe('letter settings', () => {
  it('moves settings saved before the 2026 format to it, keeping the approval signature', () => {
    const old = { letter: { signatoryName: 'Ms. Jean Ashley Chico', salutation: "Good day, Ma'am!", addressBlock: 'SUITE 3104C', hrSignature: 'data:image/png;base64,AAAA', templateVersion: '1.4' } };
    const s = normalizeSettings(old).letter;
    expect(s.formatVersion).toBe(LETTER_FORMAT_VERSION);
    expect(s.signatoryName).toBe('Ms. Jean Ashley S. Chico');
    expect(s.notedBy).toEqual(DEFAULT_NOTED_BY);
    expect(s.hrSignature).toBe('data:image/png;base64,AAAA');
  });

  it('settings with editable wording keep only HR’s "Noted by" lists', () => {
    const v2 = {
      letter: {
        formatVersion: 2,
        signatoryName: 'Ms. Jean Ashley S. Chico',
        formats: {
          intern: { closing: 'Yours truly,', notedBy: [{ name: 'Ms. New HR', title: 'HR Officer' }] },
          employee: { closing: 'Yours,', notedBy: [] },
        },
        templateVersion: '2.4',
      },
    };
    const s = normalizeSettings(v2).letter;
    expect(s.notedBy.intern).toEqual([{ name: 'Ms. New HR', title: 'HR Officer' }]);
    expect(s.notedBy.employee).toEqual(DEFAULT_NOTED_BY.employee);
    expect(s.templateVersion).toBe('3.0');
    expect('formats' in s).toBe(false);
  });

  it('saves HR’s "Noted by" lists, and needs at least one name on each', () => {
    const db = seedDb();
    const hr = { uid: 'hr-chico', name: 'Ms. Jean Ashley Chico', email: 'chico@apg-letters.test', role: 'hr' } as const;
    const { templateVersion: _v, formatVersion: _f, ...input } = db.settings.letter;
    const edited = { ...input, notedBy: { ...input.notedBy, employee: [{ name: ' Mr. New CEO ', title: 'CEO' }, ...input.notedBy.employee.slice(1)] } };
    const out = saveLetterSettings(db, hr, edited);
    expect(out.ok).toBe(true);
    if (out.ok) {
      const saved = normalizeSettings(out.changes.settings).letter;
      expect(saved.notedBy.employee[0]).toEqual({ name: 'Mr. New CEO', title: 'CEO' });
      expect(saved.templateVersion).toBe('3.1');
    }
    expect(saveLetterSettings(db, hr, { ...input, notedBy: { ...input.notedBy, intern: [] } }).ok).toBe(false);
  });
});
