import { describe, expect, it } from 'vitest';
import { applyChanges } from './db';
import { decideRequest, inputFrom, requestUids, saveRequest, setPaperCopy, withdrawRequest, type DraftInput } from './requests';
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

function input(db: Db, uid: string, over: Partial<DraftInput> = {}): DraftInput {
  return { ...inputFrom(null, user(db, uid), '2026-11-16', '2026-11-17'), reasonDetails: REASON, internSignature: SIG, ...over };
}

function member(db: Db, uid: string): GroupMember {
  const u = user(db, uid);
  return { uid: u.uid, name: u.name, internId: u.internId, position: u.position, department: u.department, memberType: 'intern', signature: SIG };
}

/** Applies an outcome the way the app does, failing the test if it was refused. */
function apply<T>(db: Db, outcome: Outcome<T>): { db: Db; value: T } {
  if (!outcome.ok) throw new Error(outcome.error);
  return { db: applyChanges(db, outcome.changes), value: outcome.value };
}

function submit(db: Db, uid: string, over: Partial<DraftInput> = {}, id = 'req-test-1') {
  return saveRequest(db, user(db, uid), input(db, uid, over), 'submitted', null, { now: NOW, newId: id, saveSignatureToProfile: false });
}

describe('filing a request', () => {
  it('books both halves of a full day for the filer', () => {
    const { db } = apply(seedDb(), submit(seedDb(), 'intern-juan'));
    expect(db.requests['req-test-1']?.status).toBe('submitted');
    expect(db.absenceSlots['intern-juan_2026-11-16_am']?.requestId).toBe('req-test-1');
    expect(db.absenceSlots['intern-juan_2026-11-16_pm']?.requestId).toBe('req-test-1');
  });

  it('a group letter books the dates for everyone on it', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, 'intern-juan', { groupMode: true, groupMembers: [member(start, 'intern-sofia')] }));
    const req = db.requests['req-test-1'];
    expect(req?.isGroup).toBe(true);
    expect(req && requestUids(req).sort()).toEqual(['intern-juan', 'intern-sofia']);
    expect(db.absenceSlots['intern-sofia_2026-11-16_am']?.requestId).toBe('req-test-1');
  });

  it('blocks a second letter for someone already out that day, even inside a group', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, 'intern-sofia'));
    const again = submit(db, 'intern-juan', { groupMode: true, groupMembers: [member(db, 'intern-sofia')] }, 'req-test-2');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toMatch(/Duplicate blocked/);
  });

  it('refuses a group with no one added, and a short reason', () => {
    const db = seedDb();
    expect(submit(db, 'intern-juan', { groupMode: true }).ok).toBe(false);
    expect(submit(db, 'intern-juan', { reasonDetails: 'too short' }).ok).toBe(false);
  });

  it('editing a waiting request moves its dates and keeps the history', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'intern-juan'));
    const juan = user(db, 'intern-juan');
    const edited = saveRequest(db, juan, input(db, 'intern-juan', { date: '2026-11-23' }), 'submitted', 'req-test-1', { now: NOW, newId: 'unused', saveSignatureToProfile: false });
    db = apply(db, edited).db;
    expect(db.absenceSlots['intern-juan_2026-11-16_am']).toBeUndefined();
    expect(db.absenceSlots['intern-juan_2026-11-23_am']?.requestId).toBe('req-test-1');
    expect(db.requests['req-test-1']?.history.map((h) => h.remarks)).toEqual(['Submitted official absence request.', 'Edited while waiting for HR review.']);
  });

  it('withdrawing frees the dates', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'intern-juan'));
    db = apply(db, withdrawRequest(db, user(db, 'intern-juan'), 'req-test-1', NOW)).db;
    expect(db.requests['req-test-1']?.status).toBe('withdrawn');
    expect(db.absenceSlots['intern-juan_2026-11-16_am']).toBeUndefined();
  });
});

describe('HR decisions', () => {
  it('approving assigns the next reference number for the year', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'intern-juan'));
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
    let { db } = apply(start, submit(start, 'intern-juan'));
    db = apply(db, decideRequest(db, user(db, 'hr-chico'), 'req-test-1', 'approved', '', NOW)).db;
    const refs = Object.values(db.requests).map((r) => r.refNo).filter(Boolean);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('returning needs remarks and frees the dates', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'intern-juan'));
    const hr = user(db, 'hr-chico');
    expect(decideRequest(db, hr, 'req-test-1', 'returned', '  ', NOW).ok).toBe(false);
    db = apply(db, decideRequest(db, hr, 'req-test-1', 'returned', 'Please add the school memo.', NOW)).db;
    expect(db.requests['req-test-1']?.status).toBe('returned');
    expect(db.absenceSlots['intern-juan_2026-11-16_am']).toBeUndefined();
  });

  it('a hand-signed paper letter waits for the paper before approval', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, 'intern-juan', { signatureMethod: 'wet-paper', internSignature: '' }));
    const hr = user(db, 'hr-chico');
    expect(decideRequest(db, hr, 'req-test-1', 'approved', '', NOW).ok).toBe(false);
    db = apply(db, setPaperCopy(db, hr, 'req-test-1', true, NOW)).db;
    expect(decideRequest(db, hr, 'req-test-1', 'approved', '', NOW).ok).toBe(true);
  });

  it('members cannot decide', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, 'intern-juan'));
    expect(decideRequest(db, user(db, 'intern-sofia'), 'req-test-1', 'approved', '', NOW).ok).toBe(false);
  });
});
