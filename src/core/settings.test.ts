import { describe, expect, it } from 'vitest';
import { normalizeSettings } from './db';
import { seedDb } from './seed';
import { isHrOfficer, mayEditSettings, saveLetterSettings, type LetterSettingsInput } from './settings';
import type { Db, User } from './types';

const CHICO: User = { uid: 'hr-chico', name: 'Ms. Jean Ashley Chico', email: 'chico@apg-letters.test', role: 'hr' };
const ANA: User = { uid: 'hr-ana', name: 'Ana Cruz', email: 'ana@apg-letters.test', role: 'hr' };

function inputOf(db: Db, over: Partial<LetterSettingsInput> = {}): LetterSettingsInput {
  const { templateVersion: _t, formatVersion: _f, ...input } = db.settings.letter;
  return { ...input, ...over };
}

const unnamed = (): Db => {
  const db = seedDb();
  return { ...db, settings: { letter: { ...db.settings.letter, hrOfficerEmail: '' } } };
};

describe('the HR officer', () => {
  it('is the account whose sign-in email Settings names, in any case', () => {
    const letter = seedDb().settings.letter;
    expect(isHrOfficer(letter, CHICO)).toBe(true);
    expect(isHrOfficer(letter, { email: ' Chico@APG-letters.test ' })).toBe(true);
    expect(isHrOfficer(letter, ANA)).toBe(false);
    expect(isHrOfficer({ hrOfficerEmail: '' }, { email: '' })).toBe(false);
  });

  it('alone changes Settings, unless none is named yet', () => {
    expect(mayEditSettings(seedDb().settings.letter, ANA)).toBe(false);
    expect(mayEditSettings(seedDb().settings.letter, CHICO)).toBe(true);
    expect(mayEditSettings(unnamed().settings.letter, ANA)).toBe(true);
  });

  it('is kept in lower case, whatever was typed', () => {
    expect(normalizeSettings({ letter: { formatVersion: 3, hrOfficerEmail: ' Chico@APG-Letters.test ' } }).letter.hrOfficerEmail).toBe('chico@apg-letters.test');
  });
});

describe('saving Settings', () => {
  it('refuses anyone but the officer', () => {
    const db = seedDb();
    expect(saveLetterSettings(db, ANA, inputOf(db))).toMatchObject({ ok: false, error: 'Only the HR officer can change the letter settings.' });
  });

  it('needs a real email for the officer', () => {
    const db = unnamed();
    for (const hrOfficerEmail of ['', 'chico', 'chico@', 'two words@x.test']) {
      expect(saveLetterSettings(db, ANA, inputOf(db, { hrOfficerEmail })).ok).toBe(false);
    }
  });

  it('lets the first HR account name the officer', () => {
    const db = unnamed();
    const out = saveLetterSettings(db, ANA, inputOf(db, { hrOfficerEmail: 'Chico@apg-letters.test' }));
    expect(out.ok && out.changes.settings?.letter.hrOfficerEmail).toBe('chico@apg-letters.test');
    expect(out.ok && out.message).toBe('Letter settings saved (template v3.1).');
  });

  it('says so when the officer hands approving over', () => {
    const db = seedDb();
    const out = saveLetterSettings(db, CHICO, inputOf(db, { hrOfficerEmail: 'ana@apg-letters.test' }));
    expect(out.ok && out.message).toBe('Saved. ana@apg-letters.test is now the HR officer who approves letters.');
  });
});
