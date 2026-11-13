import { describe, expect, it } from 'vitest';
import { inputFrom, type DraftInput } from '@/core/requests';
import { seedDb } from '@/core/seed';
import type { AbsenceRequest, User } from '@/core/types';
import { hrCall, publicCall, type HrData, type Ids, type LetterReply, type Reply } from './handlers';
import { MemoryStore } from './memory-store';

const NOW = new Date(2026, 10, 12, 9, 0, 0);
const SIG = 'data:image/png;base64,iVBORw0KGgo=';
const REASON = 'I have a required thesis defense at the university that morning.';

/** The sample data names chico@apg-letters.test as the HR officer. */
const OFFICER: User = { uid: 'hr-chico', name: 'Chico Aureo', email: 'Chico@apg-letters.test', role: 'hr' };
const OTHER_HR: User = { uid: 'hr-ana', name: 'Ana Cruz', email: 'ana@apg-letters.test', role: 'hr' };

function ids(code = 'TEST23'): Ids {
  let n = 0;
  return { requestId: () => `req-test-${++n}`, code: () => code, commentId: () => `c-test-${++n}` };
}

function form(over: Partial<DraftInput> = {}): DraftInput {
  return { ...inputFrom(null, '2026-11-16', '2026-11-17'), name: 'Maria Clara Santos', department: 'Operations', reasonDetails: REASON, internSignature: SIG, ...over };
}

function ok<T>(reply: Reply): { message: string; value: T; changes?: unknown } {
  if (!reply.ok) throw new Error(reply.error);
  return reply as { message: string; value: T; changes?: unknown };
}

function letterOf(reply: Reply): AbsenceRequest {
  return ok<LetterReply>(reply).value.letter;
}

describe('the absence form, no sign-in', () => {
  it('sends a new letter to HR and hands back its code', async () => {
    const store = new MemoryStore(seedDb());
    const reply = await publicCall(store, { action: 'submit', input: form() }, NOW, ids());
    const { value, message, changes } = ok<LetterReply>(reply);
    expect(value.code).toBe('TEST23');
    expect(value.letter.status).toBe('submitted');
    expect(message).toBe('Letter signed and sent to HR.');
    // Nothing else about the store leaves the server.
    expect(changes).toBeUndefined();
    const saved = store.snapshot().requests['req-test-1'];
    expect(saved?.accessCode).toBe('TEST23');
    expect(store.snapshot().absenceSlots['name:maria-clara-santos_2026-11-16_am']?.requestId).toBe('req-test-1');
  });

  it('picks another code when the first one is taken', async () => {
    const store = new MemoryStore(seedDb());
    const codes = ['K7Q4MZ', 'NEW234'];
    const reply = await publicCall(store, { action: 'submit', input: form() }, NOW, { ...ids(), code: () => codes.shift() ?? 'ZZZZZZ' });
    expect(ok<LetterReply>(reply).value.code).toBe('NEW234');
  });

  it('opens a letter by its code, typed any way', async () => {
    const store = new MemoryStore(seedDb());
    const letter = letterOf(await publicCall(store, { action: 'open', code: 'k7q-4mz' }, NOW));
    expect(letter.id).toBe('req-2026-004');
  });

  it("says so when there's no letter with that code", async () => {
    const store = new MemoryStore(seedDb());
    for (const code of ['ZZZ-ZZZ', 'K7Q', 42]) {
      const reply = await publicCall(store, { action: 'open', code }, NOW);
      expect(reply.ok).toBe(false);
    }
    const reply = await publicCall(store, { action: 'open', code: 'ZZZZZZ' }, NOW);
    expect(reply).toMatchObject({ ok: false, notFound: true });
  });

  it("blocks a second letter for the same person's day", async () => {
    const store = new MemoryStore(seedDb());
    // Sofia already has a pending letter on 20 Nov (D8M3JR).
    const reply = await publicCall(store, { action: 'submit', input: form({ name: 'Sofia Gabrielle Reyes', date: '2026-11-20' }) }, NOW, ids());
    expect(reply).toMatchObject({ ok: false });
    expect(!reply.ok && reply.error).toMatch(/^Duplicate blocked: You already have a pending request on/);
  });

  it('lets only one of two letters for the same day through when both arrive at once', async () => {
    const store = new MemoryStore(seedDb());
    const [a, b] = await Promise.all([
      publicCall(store, { action: 'submit', input: form() }, NOW, ids('AAAAAA')),
      publicCall(store, { action: 'submit', input: form() }, NOW, { ...ids('BBBBBB'), requestId: () => 'req-test-b' }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
  });

  it("shows the filer HR's comments only once the letter comes back", async () => {
    const store = new MemoryStore(seedDb());
    const comment = { block: 'opening', quote: 'Sofia', start: 0, body: 'Write your full name.' };
    ok(await hrCall(store, OTHER_HR, { action: 'addComment', id: 'req-2026-005', comment }, NOW, ids()));
    expect(letterOf(await publicCall(store, { action: 'open', code: 'D8M3JR' }, NOW)).comments).toHaveLength(0);
    ok(await hrCall(store, OTHER_HR, { action: 'decide', id: 'req-2026-005', decision: 'returned', remarks: '' }, NOW));
    const returned = letterOf(await publicCall(store, { action: 'open', code: 'D8M3JR' }, NOW));
    expect(returned.status).toBe('returned');
    expect(returned.comments).toHaveLength(1);
  });

  it('revises a returned letter and sends it back to HR', async () => {
    const store = new MemoryStore(seedDb());
    const before = store.snapshot().requests['req-2026-004'];
    // The sample signatures are SVG.
    const input = { ...inputFrom(before ?? null, '2026-11-16', '2026-11-17'), reasonDetails: REASON };
    const letter = letterOf(await publicCall(store, { action: 'revise', code: 'K7Q4MZ', input }, NOW));
    expect(letter.status).toBe('submitted');
    expect(letter.history.at(-1)?.remarks).toBe('Revised and resubmitted letter.');
    expect(letter.accessCode).toBe('K7Q4MZ');
  });

  it('refuses to change a letter HR already approved', async () => {
    const store = new MemoryStore(seedDb());
    const reply = await publicCall(store, { action: 'revise', code: 'TQ7K2M', input: form() }, NOW);
    expect(reply).toMatchObject({ ok: false, error: 'This letter was already decided by HR and can no longer be changed.' });
  });

  it('withdraws a waiting letter and frees its day', async () => {
    const store = new MemoryStore(seedDb());
    const letter = letterOf(await publicCall(store, { action: 'withdraw', code: 'D8M3JR' }, NOW));
    expect(letter.status).toBe('withdrawn');
    const again = await publicCall(store, { action: 'submit', input: form({ name: 'Sofia Gabrielle Reyes', date: '2026-11-20' }) }, NOW, ids());
    expect(again.ok).toBe(true);
  });

  it("doesn't give out HR's signature or the officer's email", async () => {
    const store = new MemoryStore(seedDb());
    const { value } = ok<{ letter: { hrSignature: string; hrOfficerEmail: string; companyName: string } }>(await publicCall(store, { action: 'settings' }, NOW));
    expect(value.letter.hrSignature).toBe('');
    expect(value.letter.hrOfficerEmail).toBe('');
    expect(value.letter.companyName).not.toBe('');
  });

  it('turns away whatever is not a proper request', async () => {
    const store = new MemoryStore(seedDb());
    const cases: unknown[] = [
      null,
      'submit',
      { action: 'drop' },
      { action: 'submit', input: { ...form(), name: 5 } },
      { action: 'submit', input: { ...form(), internSignature: 'javascript:alert(1)' } },
      { action: 'submit', input: { ...form(), type: 'week' } },
      { action: 'submit', input: { ...form(), groupMode: true, groupMembers: Array.from({ length: 6 }, () => ({ name: 'X', memberType: 'intern' })) } },
    ];
    for (const raw of cases) expect((await publicCall(store, raw, NOW, ids())).ok).toBe(false);
    expect(Object.keys(store.snapshot().requests)).toHaveLength(7);
  });

  it('keeps a letter to about three months of weekdays', async () => {
    const store = new MemoryStore(seedDb());
    const reply = await publicCall(store, { action: 'submit', input: form({ type: 'multi', startDate: '2026-11-16', endDate: '2027-03-31' }) }, NOW, ids());
    expect(reply).toMatchObject({ ok: false, error: 'One letter can cover at most 60 weekdays. For a longer leave, talk to HR.' });
  });

  it('keeps a letter under what Firestore can hold', async () => {
    const store = new MemoryStore(seedDb());
    const big = `data:image/png;base64,${'A'.repeat(190_000)}`;
    const people = Array.from({ length: 5 }, (_, i) => ({ uid: null, name: `Person ${i}`, internId: '', position: '', department: '', memberType: 'intern', signature: big }));
    const reply = await publicCall(store, { action: 'submit', input: form({ internSignature: big, groupMode: true, groupMembers: people as never }) }, NOW, ids());
    expect(reply).toMatchObject({ ok: false });
    expect(!reply.ok && reply.error).toMatch(/^This letter is too large/);
  });

  it('files group members without accounts, whatever the form says', async () => {
    const store = new MemoryStore(seedDb());
    const groupMembers = [{ uid: 'hr-chico', name: 'Paolo Reyes', internId: '', position: '', department: '', memberType: 'intern', signature: SIG }];
    const letter = letterOf(await publicCall(store, { action: 'submit', input: form({ groupMode: true, groupMembers: groupMembers as never }) }, NOW, ids()));
    expect(letter.groupMembers[0]?.uid).toBeNull();
    expect(letter.groupMembers[0]?.department).toBe('Operations');
  });
});

describe('HR, signed in', () => {
  it('loads every letter and says who approves', async () => {
    const store = new MemoryStore(seedDb());
    const officer = ok<HrData>(await hrCall(store, OFFICER, { action: 'load' }, NOW)).value;
    expect(officer.requests).toHaveLength(7);
    expect(officer).toMatchObject({ isOfficer: true, mayEditSettings: true });
    const other = ok<HrData>(await hrCall(store, OTHER_HR, { action: 'load' }, NOW)).value;
    expect(other).toMatchObject({ isOfficer: false, mayEditSettings: false });
  });

  it('lets only the HR officer approve, and numbers the letter', async () => {
    const store = new MemoryStore(seedDb());
    const refused = await hrCall(store, OTHER_HR, { action: 'decide', id: 'req-2026-005', decision: 'approved', remarks: '' }, NOW);
    expect(refused).toMatchObject({ ok: false });
    expect(!refused.ok && refused.error).toMatch(/^Only the HR officer/);

    const approved = ok(await hrCall(store, OFFICER, { action: 'decide', id: 'req-2026-005', decision: 'approved', remarks: '' }, NOW));
    expect(approved.message).toMatch(/APG-EL-2026-0044/);
    expect(store.snapshot().requests['req-2026-005']?.refNo).toBe('APG-EL-2026-0044');
    expect(store.snapshot().counters['2026']?.nextRefNo).toBe(45);
    // The changes come back for HR's screen to apply.
    expect(approved.changes).toBeDefined();
  });

  it('lets any HR account return or decline with remarks', async () => {
    const store = new MemoryStore(seedDb());
    const reply = await hrCall(store, OTHER_HR, { action: 'decide', id: 'req-2026-006', decision: 'declined', remarks: 'No leave credits left.' }, NOW);
    expect(reply.ok).toBe(true);
    expect(store.snapshot().requests['req-2026-006']?.status).toBe('declined');
  });

  it('keeps Settings with the HR officer', async () => {
    const store = new MemoryStore(seedDb());
    const current = store.snapshot().settings.letter;
    const { templateVersion: _t, formatVersion: _f, ...input } = current;
    const refused = await hrCall(store, OTHER_HR, { action: 'saveSettings', settings: input }, NOW);
    expect(refused).toMatchObject({ ok: false, error: 'Only the HR officer can change the letter settings.' });

    const handed = ok(await hrCall(store, OFFICER, { action: 'saveSettings', settings: { ...input, hrOfficerEmail: ' Ana@APG-letters.test ' } }, NOW));
    expect(handed.message).toBe('Saved. ana@apg-letters.test is now the HR officer who approves letters.');
    expect(ok<HrData>(await hrCall(store, OTHER_HR, { action: 'load' }, NOW)).value.isOfficer).toBe(true);
    expect(ok<HrData>(await hrCall(store, OFFICER, { action: 'load' }, NOW)).value.isOfficer).toBe(false);
  });

  it('lets anyone in HR name the officer while none is named', async () => {
    const db = seedDb();
    const store = new MemoryStore({ ...db, settings: { letter: { ...db.settings.letter, hrOfficerEmail: '' } } });
    const { templateVersion: _t, formatVersion: _f, ...input } = store.snapshot().settings.letter;
    const reply = await hrCall(store, OTHER_HR, { action: 'saveSettings', settings: { ...input, hrOfficerEmail: 'ana@apg-letters.test' } }, NOW);
    expect(reply.ok).toBe(true);
    expect(store.snapshot().settings.letter.hrOfficerEmail).toBe('ana@apg-letters.test');
  });

  it('comments, edits and deletes on a letter before the filer sees it', async () => {
    const store = new MemoryStore(seedDb());
    const comment = { block: 'opening', quote: 'Sofia', start: 0, body: 'Full name, please.' };
    const cid = ok<{ id: string }>(await hrCall(store, OTHER_HR, { action: 'addComment', id: 'req-2026-005', comment }, NOW, ids())).value.id;
    ok(await hrCall(store, OTHER_HR, { action: 'editComment', id: 'req-2026-005', commentId: cid, body: 'Your full name, please.' }, NOW));
    expect(store.snapshot().requests['req-2026-005']?.comments[0]?.body).toBe('Your full name, please.');
    ok(await hrCall(store, OTHER_HR, { action: 'deleteComment', id: 'req-2026-005', commentId: cid }, NOW));
    expect(store.snapshot().requests['req-2026-005']?.comments).toHaveLength(0);
  });

  it('resolves the comments once the revised letter is back', async () => {
    const store = new MemoryStore(seedDb());
    // K7Q4MZ came back with two comments; the filer revises it.
    const before = store.snapshot().requests['req-2026-004'];
    const input = { ...inputFrom(before ?? null, '2026-11-16', '2026-11-17'), reasonDetails: REASON };
    ok(await publicCall(store, { action: 'revise', code: 'K7Q4MZ', input }, NOW));
    const refused = await hrCall(store, OFFICER, { action: 'decide', id: 'req-2026-004', decision: 'approved', remarks: '' }, NOW);
    expect(!refused.ok && refused.error).toMatch(/^Resolve the 2 open comments/);
    ok(await hrCall(store, OFFICER, { action: 'resolveComments', id: 'req-2026-004', ids: null, resolved: true }, NOW));
    ok(await hrCall(store, OFFICER, { action: 'decide', id: 'req-2026-004', decision: 'approved', remarks: '' }, NOW));
    expect(store.snapshot().requests['req-2026-004']?.status).toBe('approved');
  });

  it('turns away bad letter ids and unknown actions', async () => {
    const store = new MemoryStore(seedDb());
    for (const raw of [{ action: 'paper', id: '../config', received: true }, { action: 'paper', id: 'req-2026-005' }, { action: 'wipe', id: 'req-2026-005' }, { action: 'decide', id: 'nope', decision: 'approved', remarks: '' }]) {
      expect((await hrCall(store, OFFICER, raw, NOW)).ok).toBe(false);
    }
  });
});
