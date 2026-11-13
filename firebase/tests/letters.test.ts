import { getAuth } from 'firebase-admin/auth';
import { beforeEach, describe, expect, it } from 'vitest';
import { admin, call, db, emailOf, FIRESTORE, makeAccount, PROJECT, refusal, resetEmulator, signIn, signInAnonymously } from './emulator';

// The deployed functions on the emulator, with real Firestore transactions: what
// the handler tests in src/server can't show (sign-in, two calls racing for the
// same half-day or reference number, the database closed to direct access).

const SIG = 'data:image/png;base64,iVBORw0KGgo=';
const REASON = 'I have a required thesis defense at the university that morning.';

type Reply<T = unknown> = { ok: true; message: string; value: T; changes?: unknown } | { ok: false; error: string; notFound?: true };
interface Letter {
  id: string;
  status: string;
  accessCode: string;
  refNo: string | null;
  comments: unknown[];
}
interface LetterReply {
  code: string;
  letter: Letter;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The `n`th weekday after today. */
function weekdayAhead(n: number): string {
  const d = new Date();
  while (n > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n--;
  }
  return ymd(d);
}

function form(over: Record<string, unknown> = {}) {
  const day = weekdayAhead(3);
  return {
    memberType: 'intern',
    name: 'Maria Clara Santos',
    position: '',
    department: 'Operations',
    type: 'full',
    date: day,
    startDate: day,
    endDate: day,
    shift: 'morning',
    timeRange: '8:00 AM – 12:00 PM',
    reasonCategory: 'Academic',
    reasonDetails: REASON,
    signatureMethod: 'digital',
    internSignature: SIG,
    wetCopyImage: '',
    groupMode: false,
    groupMembers: [],
    ...over,
  };
}

function ok<T>(reply: Reply<T>): T {
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}

const submit = (over: Record<string, unknown> = {}) => call<Reply<LetterReply>>('publicApi', { action: 'submit', input: form(over) });

beforeEach(async () => {
  await resetEmulator();
  await db().doc('config/settings').set({ letter: { formatVersion: 3, hrOfficerEmail: emailOf('chico') } });
  await makeAccount('chico', 'Jean Ashley Chico');
  await makeAccount('ana', 'Ana Cruz');
});

describe('the absence form, no sign-in', () => {
  it('sends a letter and opens it again by its code', async () => {
    const { code, letter } = ok(await submit());
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(letter.status).toBe('submitted');

    const stored = await db().doc(`requests/${letter.id}`).get();
    expect(stored.get('accessCode')).toBe(code);
    const slots = await db().collection('slots').where('requestId', '==', letter.id).get();
    expect(slots.size).toBe(2);

    const opened = ok(await call<Reply<LetterReply>>('publicApi', { action: 'open', code: `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}` }));
    expect(opened.letter.id).toBe(letter.id);
  });

  it('lets one of five letters for the same day through when they arrive together', async () => {
    const replies = await Promise.all(Array.from({ length: 5 }, () => submit()));
    expect(replies.filter((r) => r.ok)).toHaveLength(1);
    for (const r of replies.filter((r) => !r.ok)) expect(!r.ok && r.error).toMatch(/^Duplicate blocked/);
    expect((await db().collection('requests').get()).size).toBe(1);
  });

  it('frees the day when the letter is withdrawn', async () => {
    const { code } = ok(await submit());
    const withdrawn = ok(await call<Reply<LetterReply>>('publicApi', { action: 'withdraw', code }));
    expect(withdrawn.letter.status).toBe('withdrawn');
    expect((await db().collection('slots').get()).size).toBe(0);
    expect((await submit()).ok).toBe(true);
  });

  it('moves the booked days when a waiting letter is changed', async () => {
    const { code, letter } = ok(await submit());
    const later = weekdayAhead(5);
    ok(await call<Reply<LetterReply>>('publicApi', { action: 'revise', code, input: form({ date: later }) }));
    const slots = await db().collection('slots').where('requestId', '==', letter.id).get();
    expect(slots.docs.map((d) => d.id).sort()).toEqual([`name:maria-clara-santos_${later}_am`, `name:maria-clara-santos_${later}_pm`]);
  });

  it("doesn't give out HR's signature or the officer's email", async () => {
    await db().doc('config/settings').set({ letter: { formatVersion: 3, hrOfficerEmail: emailOf('chico'), hrSignature: SIG } });
    const settings = ok(await call<Reply<{ letter: { hrSignature: string; hrOfficerEmail: string } }>>('publicApi', { action: 'settings' }));
    expect(settings.letter).toMatchObject({ hrSignature: '', hrOfficerEmail: '' });
  });

  it('stops answering wrong codes after too many in an hour', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    await db().doc(`throttle/lookup-${hour}`).set({ count: 300 });
    const reply = await call<Reply>('publicApi', { action: 'open', code: 'ZZZZZZ' });
    expect(reply).toMatchObject({ ok: false });
    expect(!reply.ok && reply.error).toMatch(/^Too many wrong letter codes/);
  });

  it('counts wrong codes', async () => {
    await call('publicApi', { action: 'open', code: 'ZZZZZZ' });
    await call('publicApi', { action: 'open', code: 'YYYYYY' });
    const hour = new Date().toISOString().slice(0, 13);
    expect((await db().doc(`throttle/lookup-${hour}`).get()).get('count')).toBe(2);
  });
});

describe('HR', () => {
  it('needs a sign-in', async () => {
    expect((await refusal(call('hrApi', { action: 'load' }))).code).toBe('functions/unauthenticated');
  });

  it("isn't anyone who signs in some other way", async () => {
    const token = await signInAnonymously();
    expect((await refusal(call('hrApi', { action: 'load' }, token))).code).toBe('functions/permission-denied');
  });

  it('is shut out at once when the account is switched off', async () => {
    const token = await signIn('ana');
    const user = await getAuth(admin()).getUserByEmail(emailOf('ana'));
    await getAuth(admin()).updateUser(user.uid, { disabled: true });
    expect((await refusal(call('hrApi', { action: 'load' }, token))).code).toBe('functions/permission-denied');
  });

  it('loads every letter and says who approves', async () => {
    ok(await submit());
    const chico = ok(await call<Reply<{ requests: unknown[]; isOfficer: boolean }>>('hrApi', { action: 'load' }, await signIn('chico')));
    expect(chico.requests).toHaveLength(1);
    expect(chico.isOfficer).toBe(true);
    const ana = ok(await call<Reply<{ isOfficer: boolean }>>('hrApi', { action: 'load' }, await signIn('ana')));
    expect(ana.isOfficer).toBe(false);
  });

  it('lets only the HR officer approve, signing with their name', async () => {
    const { letter } = ok(await submit());
    const ana = await call<Reply>('hrApi', { action: 'decide', id: letter.id, decision: 'approved', remarks: '' }, await signIn('ana'));
    expect(!ana.ok && ana.error).toMatch(/^Only the HR officer/);
    ok(await call<Reply>('hrApi', { action: 'decide', id: letter.id, decision: 'approved', remarks: '' }, await signIn('chico')));
    const stored = await db().doc(`requests/${letter.id}`).get();
    expect(stored.get('status')).toBe('approved');
    expect(stored.get('review.byName')).toBe('Jean Ashley Chico');
    expect(stored.get('refNo')).toBe(`APG-EL-${new Date().getFullYear()}-0001`);
  });

  it('never gives two letters the same reference number', async () => {
    const people = ['Maria Clara Santos', 'Paolo Reyes', 'Liza Soberano', 'Mark Bautista'];
    const letters = await Promise.all(people.map(async (name) => ok(await submit({ name })).letter.id));
    const token = await signIn('chico');
    await Promise.all(letters.map((id) => call<Reply>('hrApi', { action: 'decide', id, decision: 'approved', remarks: '' }, token).then(ok)));
    const refs = (await db().collection('requests').get()).docs.map((d) => d.get('refNo') as string);
    expect(new Set(refs).size).toBe(4);
    expect((await db().doc('config/counters').get()).get(String(new Date().getFullYear()))).toEqual({ nextRefNo: 5 });
  });

  it("shows the filer HR's comments once the letter is returned", async () => {
    const { code, letter } = ok(await submit());
    const token = await signIn('ana');
    ok(await call<Reply>('hrApi', { action: 'addComment', id: letter.id, comment: { block: 'opening', quote: 'Maria', start: 0, body: 'Add your middle name.' } }, token));
    expect(ok(await call<Reply<LetterReply>>('publicApi', { action: 'open', code })).letter.comments).toHaveLength(0);
    ok(await call<Reply>('hrApi', { action: 'decide', id: letter.id, decision: 'returned', remarks: '' }, token));
    expect(ok(await call<Reply<LetterReply>>('publicApi', { action: 'open', code })).letter.comments).toHaveLength(1);
  });

  it('lets the first HR account name the officer, then only the officer changes Settings', async () => {
    await db().doc('config/settings').delete();
    const settings = {
      hrOfficerEmail: emailOf('ana'),
      signatoryName: 'Ana Cruz',
      signatoryTitle: 'HR Officer',
      companyName: 'Alpha Premier Group',
      subject: 'Notice of Absence',
      notedBy: { intern: [{ name: 'A', title: 'CEO' }], employee: [{ name: 'A', title: 'CEO' }] },
      hrSignature: '',
      attachmentsEnabled: false,
    };
    ok(await call<Reply>('hrApi', { action: 'saveSettings', settings }, await signIn('chico')));
    expect((await db().doc('config/settings').get()).get('letter.hrOfficerEmail')).toBe(emailOf('ana'));
    const again = await call<Reply>('hrApi', { action: 'saveSettings', settings: { ...settings, hrOfficerEmail: emailOf('chico') } }, await signIn('chico'));
    expect(again).toMatchObject({ ok: false, error: 'Only the HR officer can change the letter settings.' });
  });
});

describe('the database', () => {
  it('is closed to everyone but the functions', async () => {
    ok(await submit());
    for (const path of ['requests', 'slots', 'config/settings']) {
      const reply = await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`);
      expect(reply.status).toBe(403);
    }
    const write = await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/requests?documentId=evil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { status: { stringValue: 'approved' } } }),
    });
    expect(write.status).toBe(403);
  });
});
