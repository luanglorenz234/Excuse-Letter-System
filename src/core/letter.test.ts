import { describe, expect, it } from 'vitest';
import { saveLetterSettings } from './accounts';
import { DEFAULT_FORMATS, normalizeSettings } from './db';
import { formatLetterDate, letterDateYmd, openingText, reasonClause, wordingFor } from './letter';
import { buildDraft, inputFrom } from './requests';
import { seedDb } from './seed';
import { LETTER_FORMAT_VERSION, type AbsenceRequest, type GroupMember, type MemberType } from './types';

const NOW = new Date(2026, 9, 26, 9, 0, 0);

function request(memberType: MemberType, over: Partial<ReturnType<typeof inputFrom>>): AbsenceRequest {
  const db = seedDb();
  const user = db.users['intern-juan'];
  if (!user) throw new Error('no sample user');
  const input = { ...inputFrom(null, user, '2026-10-27', '2026-10-28'), memberType, ...over };
  return buildDraft(input, user, null, NOW);
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
    expect(wordingFor({ memberType: 'intern' }, s).closing).toBe('Respectfully,');
    expect(wordingFor({ memberType: 'employee' }, s).closing).toBe('Very respectfully yours,');
    expect(wordingFor({ memberType: 'employee' }, s).notedBy.map((n) => n.title)).toEqual(['CEO', 'HR Officer', 'HR / Marketing Officer']);
  });
});

describe('letter settings', () => {
  it('moves settings saved before the new format to it, keeping the approval signature', () => {
    const old = { letter: { signatoryName: 'Ms. Jean Ashley Chico', salutation: "Good day, Ma'am!", addressBlock: 'SUITE 3104C', hrSignature: 'data:image/png;base64,AAAA', templateVersion: '1.4' } };
    const s = normalizeSettings(old).letter;
    expect(s.formatVersion).toBe(LETTER_FORMAT_VERSION);
    expect(s.signatoryName).toBe('Ms. Jean Ashley S. Chico');
    expect(s.formats.intern).toEqual(DEFAULT_FORMATS.intern);
    expect(s.hrSignature).toBe('data:image/png;base64,AAAA');
  });

  it('keeps HR edits to the new format', () => {
    const db = seedDb();
    const hr = db.users['hr-chico'];
    if (!hr) throw new Error('no HR');
    const { templateVersion: _v, formatVersion: _f, ...input } = db.settings.letter;
    const edited = { ...input, formats: { ...input.formats, employee: { ...input.formats.employee, closing: 'Respectfully yours,' } } };
    const out = saveLetterSettings(db, hr, edited);
    expect(out.ok).toBe(true);
    if (out.ok) {
      const saved = normalizeSettings(out.changes.settings).letter;
      expect(saved.formats.employee.closing).toBe('Respectfully yours,');
      expect(saved.templateVersion).toBe('2.1');
    }
    const noOne = { ...input, formats: { ...input.formats, intern: { ...input.formats.intern, notedBy: [] } } };
    expect(saveLetterSettings(db, hr, noOne).ok).toBe(false);
  });
});
