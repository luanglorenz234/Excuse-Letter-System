/**
 * HR's letter settings, and the one HR account that approves.
 *
 * Every account on the apg-letters Firebase project is HR (accounts are made
 * only for HR, in the Firebase console), so nobody needs a role. The only
 * difference between HR accounts is the HR officer, named in Settings by
 * sign-in email: that account approves and signs letters, and edits Settings.
 * Until one is named, any HR account may name it.
 */

import { LETTER_FORMAT_VERSION, type Db, type LetterSettings, type MemberType, type NotedBy, type Outcome, type User } from './types';

/** The approving HR officer, by sign-in email. */
export function isHrOfficer(letter: Pick<LetterSettings, 'hrOfficerEmail'>, user: Pick<User, 'email'>): boolean {
  return letter.hrOfficerEmail !== '' && user.email.trim().toLowerCase() === letter.hrOfficerEmail;
}

/** Who may change Settings: the HR officer, or anyone in HR while none is named. */
export function mayEditSettings(letter: Pick<LetterSettings, 'hrOfficerEmail'>, user: Pick<User, 'email'>): boolean {
  return letter.hrOfficerEmail === '' || isHrOfficer(letter, user);
}

/** What HR edits in Settings → Letter. The wording itself is fixed (DEFAULT_FORMATS). */
export type LetterSettingsInput = Omit<LetterSettings, 'templateVersion' | 'formatVersion'>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanNotedBy = (list: readonly NotedBy[]): NotedBy[] => list.map((n) => ({ name: n.name.trim(), title: n.title.trim() })).filter((n) => n.name);

/** Saves HR's letter settings; each save is a new template version (3.0 → 3.1). */
export function saveLetterSettings(db: Db, hr: User, next: LetterSettingsInput): Outcome<{ version: string }> {
  if (hr.role !== 'hr') return { ok: false, error: 'Only HR can change the letter.' };
  if (!mayEditSettings(db.settings.letter, hr)) return { ok: false, error: 'Only the HR officer can change the letter settings.' };
  const officer = next.hrOfficerEmail.trim().toLowerCase();
  if (!EMAIL.test(officer)) return { ok: false, error: "Enter the HR officer's sign-in email: that account approves and signs letters." };
  const general = [next.signatoryName, next.signatoryTitle, next.companyName, next.subject];
  if (general.some((v) => !v.trim())) return { ok: false, error: 'Fill in the HR officer, title, company and subject.' };
  const notedBy: Record<MemberType, NotedBy[]> = { intern: cleanNotedBy(next.notedBy.intern), employee: cleanNotedBy(next.notedBy.employee) };
  for (const type of ['intern', 'employee'] as const) {
    if (notedBy[type].length === 0) return { ok: false, error: `List at least one person under "Noted by" on the ${type} letter.` };
  }
  const [major, minor] = db.settings.letter.templateVersion.split('.');
  const version = `${major ?? '3'}.${Number(minor ?? 0) + 1}`;
  const letter: LetterSettings = {
    ...db.settings.letter,
    ...next,
    formatVersion: LETTER_FORMAT_VERSION,
    hrOfficerEmail: officer,
    signatoryName: next.signatoryName.trim(),
    signatoryTitle: next.signatoryTitle.trim(),
    companyName: next.companyName.trim(),
    subject: next.subject.trim(),
    notedBy,
    templateVersion: version,
  };
  const handedOver = officer !== db.settings.letter.hrOfficerEmail && db.settings.letter.hrOfficerEmail !== '';
  return {
    ok: true,
    value: { version },
    message: handedOver ? `Saved. ${officer} is now the HR officer who approves letters.` : `Letter settings saved (template v${version}).`,
    changes: { settings: { letter } },
  };
}
