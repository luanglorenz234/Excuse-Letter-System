import { describe, expect, it } from 'vitest';
import { addComment } from './comments';
import { applyChanges } from './db';
import {
  decideRequest,
  findByAccessCode,
  formatAccessCode,
  inputFrom,
  requestUids,
  saveRequest,
  setPaperCopy,
  withdrawRequest,
  type DraftInput,
} from './requests';
import { seedDb } from './seed';
import type { Db, GroupMember, Outcome, User } from './types';

const NOW = new Date(2026, 10, 12, 9, 0, 0);
const SIG = 'data:image/png;base64,iVBORw0KGgo=';
const REASON = 'I have a required thesis defense at the university that morning.';

function user(db: Db, uid: string): User {
  const u = db.users[uid];
  if (!u) throw new Error(`no user ${uid}`);
  return u;
}

/** The form filled in: by an employee's account (uid), or by an intern with no account (null). */
function input(db: Db, uid: string | null, over: Partial<DraftInput> = {}): DraftInput {
  const filer = uid ? user(db, uid) : null;
  const base = inputFrom(null, filer, '2026-11-16', '2026-11-17');
  const intern = filer ? {} : { name: 'Maria Clara Santos', department: 'Operations' };
  return { ...base, ...intern, reasonDetails: REASON, internSignature: SIG, ...over };
}

function member(db: Db, uid: string): GroupMember {
  const u = user(db, uid);
  return { uid: u.uid, name: u.name, internId: u.internId, position: u.position, department: u.department, memberType: 'employee', signature: SIG };
}

/** Applies an outcome the way the app does, failing the test if it was refused. */
function apply<T>(db: Db, outcome: Outcome<T>): { db: Db; value: T } {
  if (!outcome.ok) throw new Error(outcome.error);
  return { db: applyChanges(db, outcome.changes), value: outcome.value };
}

function submit(db: Db, uid: string | null, over: Partial<DraftInput> = {}, id = 'req-test-1', code = 'TEST23') {
  return saveRequest(db, uid ? user(db, uid) : null, input(db, uid, over), 'submitted', null, {
    now: NOW,
    newId: id,
    saveSignatureToProfile: false,
    newCode: () => code,
  });
}

describe('an employee filing from their account', () => {
  it('books both halves of a full day for the filer', () => {
    const { db } = apply(seedDb(), submit(seedDb(), 'emp-carlos'));
    const req = db.requests['req-test-1'];
    expect(req?.status).toBe('submitted');
    expect(req?.memberType).toBe('employee');
    expect(req?.accessCode).toBeNull();
    expect(db.absenceSlots['emp-carlos_2026-11-16_am']?.requestId).toBe('req-test-1');
    expect(db.absenceSlots['emp-carlos_2026-11-16_pm']?.requestId).toBe('req-test-1');
  });

  it('types the position and department on the letter', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, 'emp-carlos', { position: 'Senior Operations Associate', department: 'Operations' }));
    expect(db.requests['req-test-1']?.snapshot).toMatchObject({ name: 'Carlos Eduardo Mendoza', position: 'Senior Operations Associate', department: 'Operations' });
    const noPosition = submit(start, 'emp-carlos', { position: '  ' });
    expect(noPosition.ok).toBe(false);
    if (!noPosition.ok) expect(noPosition.error).toMatch(/position/);
  });

  it('a group letter books the dates for everyone on it', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, 'emp-carlos', { groupMode: true, groupMembers: [member(start, 'emp-ana')] }));
    const req = db.requests['req-test-1'];
    expect(req?.isGroup).toBe(true);
    expect(req && requestUids(req).sort()).toEqual(['emp-ana', 'emp-carlos']);
    expect(db.absenceSlots['emp-ana_2026-11-16_am']?.requestId).toBe('req-test-1');
  });

  it('blocks a second letter for someone already out that day, even inside a group', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, 'emp-ana'));
    const again = submit(db, 'emp-carlos', { groupMode: true, groupMembers: [member(db, 'emp-ana')] }, 'req-test-2');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toMatch(/Duplicate blocked: Ana Patricia Lim already has/);
  });

  it('refuses a group with no one added, and a short reason', () => {
    const db = seedDb();
    expect(submit(db, 'emp-carlos', { groupMode: true }).ok).toBe(false);
    expect(submit(db, 'emp-carlos', { reasonDetails: 'too short' }).ok).toBe(false);
  });

  it('editing a waiting request moves its dates and keeps the history', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'emp-carlos'));
    const carlos = user(db, 'emp-carlos');
    const edited = saveRequest(db, carlos, input(db, 'emp-carlos', { date: '2026-11-23' }), 'submitted', 'req-test-1', { now: NOW, newId: 'unused', saveSignatureToProfile: false });
    db = apply(db, edited).db;
    expect(db.absenceSlots['emp-carlos_2026-11-16_am']).toBeUndefined();
    expect(db.absenceSlots['emp-carlos_2026-11-23_am']?.requestId).toBe('req-test-1');
    expect(db.requests['req-test-1']?.history.map((h) => h.remarks)).toEqual(['Submitted official absence request.', 'Edited while waiting for HR review.']);
  });

  it('withdrawing frees the dates', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'emp-carlos'));
    db = apply(db, withdrawRequest(db, user(db, 'emp-carlos'), 'req-test-1', NOW)).db;
    expect(db.requests['req-test-1']?.status).toBe('withdrawn');
    expect(db.absenceSlots['emp-carlos_2026-11-16_am']).toBeUndefined();
  });

  it('an account that is not an employee cannot file', () => {
    const db = seedDb();
    const oldIntern: User = { ...user(db, 'emp-ana'), uid: 'intern-old', role: 'intern', memberType: 'intern' };
    expect(saveRequest(db, oldIntern, input(db, 'emp-ana'), 'submitted', null, { now: NOW, newId: 'x', saveSignatureToProfile: false }).ok).toBe(false);
    expect(saveRequest(db, user(db, 'hr-chico'), input(db, 'emp-ana'), 'submitted', null, { now: NOW, newId: 'x', saveSignatureToProfile: false }).ok).toBe(false);
  });
});

describe('an intern filing without an account', () => {
  it('gets the intern letter, no account, and a code to open it again', () => {
    const start = seedDb();
    const out = submit(start, null);
    const { db, value } = apply(start, out);
    expect(value.accessCode).toBe('TEST23');
    const req = db.requests['req-test-1'];
    expect(req).toMatchObject({ uid: '', memberType: 'intern', accessCode: 'TEST23', memberUids: [] });
    expect(req?.snapshot).toMatchObject({ name: 'Maria Clara Santos', department: 'Operations', position: '' });
    expect(findByAccessCode(db, ' tes-t23 ')?.id).toBe('req-test-1');
    expect(formatAccessCode('TEST23')).toBe('TES-T23');
    // An intern's half-days are theirs by name.
    expect(db.absenceSlots['name:maria-clara-santos_2026-11-16_am']?.requestId).toBe('req-test-1');
  });

  it('needs a name and a department, and has no drafts', () => {
    const db = seedDb();
    expect(submit(db, null, { name: ' ' }).ok).toBe(false);
    expect(submit(db, null, { department: '' }).ok).toBe(false);
    const draft = saveRequest(db, null, input(db, null), 'draft', null, { now: NOW, newId: 'x', saveSignatureToProfile: false });
    expect(draft.ok).toBe(false);
  });

  it('the duplicate guard knows an intern by name', () => {
    // The sample data has Sofia Gabrielle Reyes waiting for HR on 2026-11-20.
    const db = seedDb();
    const again = submit(db, null, { name: ' sofia gabrielle  REYES', date: '2026-11-20' });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toMatch(/You already have a pending request/);
  });

  it('group members typed in take the filer’s department when left blank', () => {
    const start = seedDb();
    const kevs: GroupMember = { uid: null, name: 'Kevin Ramos', internId: '', position: '', department: '', memberType: 'intern', signature: SIG };
    const { db } = apply(start, submit(start, null, { groupMode: true, groupMembers: [kevs] }));
    expect(db.requests['req-test-1']?.groupMembers[0]?.department).toBe('Operations');
    expect(db.absenceSlots['name:kevin-ramos_2026-11-16_am']?.requestId).toBe('req-test-1');
  });

  it('never gives two letters the same code', () => {
    const codes = ['K7Q4MZ', 'NEW234'];
    const db = seedDb();
    const out = saveRequest(db, null, input(db, null), 'submitted', null, { now: NOW, newId: 'req-test-1', saveSignatureToProfile: false, newCode: () => codes.shift() ?? 'ZZZZZZ' });
    expect(out.ok && out.value.accessCode).toBe('NEW234');
  });

  it('revises a returned letter opened with its code, keeping HR’s comments', () => {
    const db = seedDb();
    const returned = db.requests['req-2026-004'];
    if (!returned) throw new Error('no sample returned letter');
    expect(returned.comments.length).toBe(2);
    const revised = { ...inputFrom(returned, null, '2026-11-16', '2026-11-17'), reasonDetails: 'I need to meet my Faculty Coordinator from 1:00 to 3:00 PM to submit my midterm evaluation forms.' };
    const out = saveRequest(db, null, revised, 'submitted', returned.id, { now: NOW, newId: 'unused', saveSignatureToProfile: false });
    const next = apply(db, out).db.requests[returned.id];
    expect(next?.status).toBe('submitted');
    expect(next?.accessCode).toBe('K7Q4MZ');
    expect(next?.comments).toEqual(returned.comments);
  });

  it('cannot change an approved letter, or one filed from an account', () => {
    const db = seedDb();
    const approved = db.requests['req-2026-001'];
    const employees = db.requests['req-2026-006'];
    if (!approved || !employees) throw new Error('no sample letters');
    expect(saveRequest(db, null, inputFrom(approved, null, '', ''), 'submitted', approved.id, { now: NOW, newId: 'x', saveSignatureToProfile: false }).ok).toBe(false);
    expect(saveRequest(db, null, inputFrom(employees, null, '', ''), 'submitted', employees.id, { now: NOW, newId: 'x', saveSignatureToProfile: false }).ok).toBe(false);
    expect(withdrawRequest(db, null, employees.id, NOW).ok).toBe(false);
  });

  it('withdraws a waiting letter opened with its code', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, null));
    db = apply(db, withdrawRequest(db, null, 'req-test-1', NOW)).db;
    expect(db.requests['req-test-1']?.status).toBe('withdrawn');
    expect(db.absenceSlots['name:maria-clara-santos_2026-11-16_am']).toBeUndefined();
  });
});

describe('HR decisions', () => {
  it('approving assigns the next reference number for the year', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'emp-carlos'));
    const seq = db.counters['2026']?.nextRefNo ?? 1;
    db = apply(db, decideRequest(db, user(db, 'hr-chico'), 'req-test-1', 'approved', '', NOW)).db;
    const req = db.requests['req-test-1'];
    expect(req?.status).toBe('approved');
    expect(req?.refNo).toBe(`APG-EL-2026-${String(seq).padStart(4, '0')}`);
    expect(req?.review?.hrSignature).toBe(db.settings.letter.hrSignature);
    expect(db.counters['2026']?.nextRefNo).toBe(seq + 1);
  });

  it('never reuses a reference number, even when the counter fell behind', () => {
    const start = applyChanges(seedDb(), { counters: { '2026': { nextRefNo: 1 } } });
    let { db } = apply(start, submit(start, 'emp-carlos'));
    db = apply(db, decideRequest(db, user(db, 'hr-chico'), 'req-test-1', 'approved', '', NOW)).db;
    const refs = Object.values(db.requests).map((r) => r.refNo).filter(Boolean);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('returning needs remarks or a comment, and frees the dates', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'emp-carlos'));
    const hr = user(db, 'hr-chico');
    expect(decideRequest(db, hr, 'req-test-1', 'returned', '  ', NOW).ok).toBe(false);
    db = apply(db, decideRequest(db, hr, 'req-test-1', 'returned', 'Please add the school memo.', NOW)).db;
    expect(db.requests['req-test-1']?.status).toBe('returned');
    expect(db.absenceSlots['emp-carlos_2026-11-16_am']).toBeUndefined();
  });

  it('returning with comments on the letter sends them, with no remarks needed', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, null));
    const hr = user(db, 'hr-chico');
    db = apply(db, addComment(db, hr, 'req-test-1', { block: 'opening', quote: 'thesis defense', start: 0, body: 'Attach the defense schedule.' }, NOW, 'c1')).db;
    expect(db.requests['req-test-1']?.comments[0]?.sentAt).toBeNull();
    db = apply(db, decideRequest(db, hr, 'req-test-1', 'returned', '', NOW)).db;
    const req = db.requests['req-test-1'];
    expect(req?.status).toBe('returned');
    expect(req?.review?.remarks).toBe('Returned with 1 comment on the letter.');
    expect(req?.comments[0]?.sentAt).toBe(NOW.toISOString());
  });

  it('approval waits until every comment is resolved', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'emp-carlos'));
    const hr = user(db, 'hr-chico');
    db = apply(db, addComment(db, hr, 'req-test-1', { block: 'opening', quote: 'thesis', start: 0, body: 'Which thesis?' }, NOW, 'c1')).db;
    const blocked = decideRequest(db, hr, 'req-test-1', 'approved', '', NOW);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Resolve the open comment/);
  });

  it('a hand-signed paper letter waits for the paper before approval', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'emp-carlos', { signatureMethod: 'wet-paper', internSignature: '' }));
    const hr = user(db, 'hr-chico');
    expect(decideRequest(db, hr, 'req-test-1', 'approved', '', NOW).ok).toBe(false);
    db = apply(db, setPaperCopy(db, hr, 'req-test-1', true, NOW)).db;
    expect(decideRequest(db, hr, 'req-test-1', 'approved', '', NOW).ok).toBe(true);
  });

  it('members cannot decide', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, 'emp-carlos'));
    expect(decideRequest(db, user(db, 'emp-ana'), 'req-test-1', 'approved', '', NOW).ok).toBe(false);
  });
});
