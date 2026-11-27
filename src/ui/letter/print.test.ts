// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { seedDb } from '@/core/seed';
import { letterPrintTitle, printLetter } from './print';

describe('letterPrintTitle', () => {
  const db = seedDb();
  const requests = Object.values(db.requests);

  it('uses reference number for approved letters, access code for pending/returned, and strips illegal characters', () => {
    const approved = requests.find((r) => r.refNo)!;
    expect(letterPrintTitle(approved)).toBe(`${approved.refNo} - ${approved.snapshot.name} - ${approved.date}`);

    const coded = requests.find((r) => !r.refNo && r.accessCode === 'K7Q4MZ')!;
    expect(letterPrintTitle(coded)).toBe(`K7Q-4MZ - ${coded.snapshot.name} - ${coded.date}`);

    const draft = {
      ...coded,
      refNo: null,
      accessCode: null,
      snapshot: { ...coded.snapshot, name: 'Juan/Dela:Cruz' },
    };
    expect(letterPrintTitle(draft)).toBe(`Notice of Absence - Juan-Dela-Cruz - ${coded.date}`);
  });

  it('sets document.title during window.print() and restores it afterward', async () => {
    const mount = document.createElement('div');
    mount.id = 'print-root';
    document.body.appendChild(mount);
    document.title = 'APG Excuse Letters';

    const approved = requests.find((r) => r.refNo)!;
    let titleDuringPrint = '';
    const imgComplete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const spy = vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title;
    });

    await printLetter(approved, db.settings.letter);
    expect(titleDuringPrint).toBe(letterPrintTitle(approved));
    expect(document.title).toBe('APG Excuse Letters');

    spy.mockRestore();
    imgComplete.mockRestore();
    mount.remove();
  });
});
