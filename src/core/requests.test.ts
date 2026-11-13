import { describe, expect, it } from 'vitest';
import { addComment } from './comments';
import { applyChanges } from './db';
import { canRevise, decideRequest, findByAccessCode, formatAccessCode, inputFrom, saveRequest, setPaperCopy, withdrawRequest, type DraftInput } from './requests';
import { seedDb } from './seed';
import type { Db, GroupMember, Outcome, User } from './types';

const NOW = new Date(2026, 10, 12, 9, 0, 0);
const SIG = 'data:image/png;base64,iVBORw0KGgo=';
const REASON = 'I have a required thesis defense at the university that morning.';

/** The sample data names chico@apg-letters.test as the HR officer. */
const OFFICER: User = { uid: 'hr-chico', name: 'Ms. Jean Ashley Chico', email: 'chico@apg-letters.test', role: 'hr' };
const OTHER_HR: User = { uid: 'hr-ana', name: 'Ana Cruz', email: 'ana@apg-letters.test', role: 'hr' };

/** The form filled in. Nobody filing has an account. */
function input(over: Partial<DraftInput> = {}): DraftInput {
  return { ...inputFrom(null, '2026-11-16', '2026-11-17'), name: 'Maria Clara Santos', department: 'Operations', reasonDetails: REASON, internSignature: SIG, ...over };
}

function employee(over: Partial<DraftInput> = {}): DraftInput {
  return input({ memberType: 'employee', name: 'Paolo Reyes', position: 'Operations Associate', ...over });
}

function person(name: string, memberType: GroupMember['memberType'] = 'intern'): GroupMember {
  return { uid: null, name, internId: '', position: '', department: '', memberType, signature: SIG };
}

/** Applies an outcome the way the server does, failing the test if it was refused. */
function apply<T>(db: Db, outcome: Outcome<T>): { db: Db; value: T } {
  if (!outcome.ok) throw new Error(outcome.error);
  return { db: applyChanges(db, outcome.changes), value: outcome.value };
}

function submit(db: Db, form: DraftInput = input(), id = 'req-test-1', code = 'TEST23') {
  return saveRequest(db, form, null, { now: NOW, newId: id, newCode: () => code });
}

describe('filing a letter, no account', () => {
  it('gets the intern letter and a code to open it again', () => {
    const start = seedDb();
    const { db, value } = apply(start, submit(start));
    expect(value).toEqual({ id: 'req-test-1', accessCode: 'TEST23' });
    const req = db.requests['req-test-1'];
    expect(req).toMatchObject({ uid: '', memberType: 'intern', accessCode: 'TEST23', status: 'submitted', memberUids: [] });
    expect(req?.snapshot).toMatchObject({ name: 'Maria Clara Santos', department: 'Operations', position: '' });
    expect(req?.history.map((h) => h.remarks)).toEqual(['Submitted through the absence form.']);
    expect(findByAccessCode(db, ' tes-t23 ')?.id).toBe('req-test-1');
    expect(formatAccessCode('TEST23')).toBe('TES-T23');
    // Half-days are a person's by name.
    expect(db.absenceSlots['name:maria-clara-santos_2026-11-16_am']?.requestId).toBe('req-test-1');
    expect(db.absenceSlots['name:maria-clara-santos_2026-11-16_pm']?.requestId).toBe('req-test-1');
  });

  it('an employee gets the employee letter, with their position on it', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, employee()));
    expect(db.requests['req-test-1']).toMatchObject({ memberType: 'employee', uid: '', accessCode: 'TEST23' });
    expect(db.requests['req-test-1']?.snapshot).toMatchObject({ name: 'Paolo Reyes', position: 'Operations Associate', department: 'Operations' });
    const noPosition = submit(start, employee({ position: '  ' }));
    expect(!noPosition.ok && noPosition.error).toMatch(/position/);
  });

  it("an intern's position is never printed", () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, input({ position: 'Should not show' })));
    expect(db.requests['req-test-1']?.snapshot.position).toBe('');
  });

  it('needs a name, a department and a long enough reason', () => {
    const db = seedDb();
    expect(submit(db, input({ name: ' ' })).ok).toBe(false);
    expect(submit(db, input({ department: '' })).ok).toBe(false);
    expect(submit(db, input({ reasonDetails: 'too short' })).ok).toBe(false);
    expect(submit(db, input({ groupMode: true })).ok).toBe(false);
  });

  it('a group letter books the dates for everyone on it, by name', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start, input({ groupMode: true, groupMembers: [person('Kevin Ramos')] })));
    expect(db.requests['req-test-1']?.isGroup).toBe(true);
    // Left blank, a member's department is the filer's.
    expect(db.requests['req-test-1']?.groupMembers[0]?.department).toBe('Operations');
    expect(db.absenceSlots['name:kevin-ramos_2026-11-16_am']?.requestId).toBe('req-test-1');
  });

  it('blocks a second letter for someone already out that day, by name and inside a group', () => {
    // The sample data has Sofia Gabrielle Reyes waiting for HR on 2026-11-20.
    const db = seedDb();
    const again = submit(db, input({ name: ' sofia gabrielle  REYES', date: '2026-11-20' }));
    expect(!again.ok && again.error).toMatch(/Duplicate blocked: You already have a pending request/);
    const inGroup = submit(db, input({ date: '2026-11-20', groupMode: true, groupMembers: [person('Sofia Gabrielle Reyes')] }));
    expect(!inGroup.ok && inGroup.error).toMatch(/Duplicate blocked: Sofia Gabrielle Reyes already has/);
  });

  it('never gives two letters the same code', () => {
    const codes = ['K7Q4MZ', 'NEW234'];
    const db = seedDb();
    const out = saveRequest(db, input(), null, { now: NOW, newId: 'req-test-1', newCode: () => codes.shift() ?? 'ZZZZZZ' });
    expect(out.ok && out.value.accessCode).toBe('NEW234');
  });
});

describe('a letter opened with its code', () => {
  it('can be changed while it waits, moving its dates and keeping its history', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start));
    db = apply(db, saveRequest(db, input({ date: '2026-11-23' }), 'req-test-1', { now: NOW, newId: 'unused' })).db;
    expect(db.absenceSlots['name:maria-clara-santos_2026-11-16_am']).toBeUndefined();
    expect(db.absenceSlots['name:maria-clara-santos_2026-11-23_am']?.requestId).toBe('req-test-1');
    expect(db.requests['req-test-1']?.history.map((h) => h.remarks)).toEqual(['Submitted through the absence form.', 'Edited while waiting for HR review.']);
    expect(db.requests['req-test-1']?.accessCode).toBe('TEST23');
  });

  it('revises a returned letter, keeping HR’s comments', () => {
    const db = seedDb();
    const returned = db.requests['req-2026-004'];
    if (!returned) throw new Error('no sample returned letter');
    expect(returned.comments.length).toBe(2);
    const revised = { ...inputFrom(returned, '2026-11-16', '2026-11-17'), reasonDetails: 'I need to meet my Faculty Coordinator from 1:00 to 3:00 PM to submit my midterm evaluation forms.' };
    const next = apply(db, saveRequest(db, revised, returned.id, { now: NOW, newId: 'unused' })).db.requests[returned.id];
    expect(next?.status).toBe('submitted');
    expect(next?.accessCode).toBe('K7Q4MZ');
    expect(next?.comments).toEqual(returned.comments);
    expect(next?.history.at(-1)?.remarks).toBe('Revised and resubmitted letter.');
  });

  it('cannot be changed once HR approved it', () => {
    const db = seedDb();
    const approved = db.requests['req-2026-001'];
    if (!approved) throw new Error('no sample letter');
    expect(canRevise(approved)).toBe(false);
    expect(saveRequest(db, inputFrom(approved, '', ''), approved.id, { now: NOW, newId: 'x' }).ok).toBe(false);
    expect(withdrawRequest(db, approved.id, NOW).ok).toBe(false);
  });

  it('withdrawing frees the dates', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start));
    db = apply(db, withdrawRequest(db, 'req-test-1', NOW)).db;
    expect(db.requests['req-test-1']?.status).toBe('withdrawn');
    expect(db.absenceSlots['name:maria-clara-santos_2026-11-16_am']).toBeUndefined();
  });
});

describe('HR decisions', () => {
  it('approving by the HR officer assigns the next reference number for the year', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start));
    const seq = db.counters['2026']?.nextRefNo ?? 1;
    db = apply(db, decideRequest(db, OFFICER, 'req-test-1', 'approved', '', NOW)).db;
    const req = db.requests['req-test-1'];
    expect(req?.status).toBe('approved');
    expect(req?.refNo).toBe(`APG-EL-2026-${String(seq).padStart(4, '0')}`);
    expect(req?.review).toMatchObject({ byName: OFFICER.name, hrSignature: db.settings.letter.hrSignature });
    expect(db.counters['2026']?.nextRefNo).toBe(seq + 1);
  });

  it('only the HR officer approves; anyone in HR returns or declines', () => {
    const start = seedDb();
    const { db } = apply(start, submit(start));
    const refused = decideRequest(db, OTHER_HR, 'req-test-1', 'approved', '', NOW);
    expect(!refused.ok && refused.error).toMatch(/^Only the HR officer named in Settings/);
    expect(decideRequest(db, OTHER_HR, 'req-test-1', 'declined', 'No leave credits left.', NOW).ok).toBe(true);
  });

  it('nobody approves until an HR officer is named', () => {
    const start = seedDb();
    const unnamed = { ...start, settings: { letter: { ...start.settings.letter, hrOfficerEmail: '' } } };
    const { db } = apply(unnamed, submit(unnamed));
    const refused = decideRequest(db, OFFICER, 'req-test-1', 'approved', '', NOW);
    expect(!refused.ok && refused.error).toMatch(/^Name the HR officer in Settings first/);
  });

  it('never reuses a reference number, even when the counter fell behind', () => {
    const start = applyChanges(seedDb(), { counters: { '2026': { nextRefNo: 1 } } });
    let { db } = apply(start, submit(start));
    db = apply(db, decideRequest(db, OFFICER, 'req-test-1', 'approved', '', NOW)).db;
    const refs = Object.values(db.requests).map((r) => r.refNo).filter(Boolean);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('returning needs remarks or a comment, and frees the dates', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start));
    expect(decideRequest(db, OTHER_HR, 'req-test-1', 'returned', '  ', NOW).ok).toBe(false);
    db = apply(db, decideRequest(db, OTHER_HR, 'req-test-1', 'returned', 'Please add the school memo.', NOW)).db;
    expect(db.requests['req-test-1']?.status).toBe('returned');
    expect(db.absenceSlots['name:maria-clara-santos_2026-11-16_am']).toBeUndefined();
  });

  it('returning with comments on the letter sends them, with no remarks needed', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start));
    db = apply(db, addComment(db, OTHER_HR, 'req-test-1', { block: 'opening', quote: 'thesis defense', start: 0, body: 'Attach the defense schedule.' }, NOW, 'c1')).db;
    expect(db.requests['req-test-1']?.comments[0]?.sentAt).toBeNull();
    db = apply(db, decideRequest(db, OTHER_HR, 'req-test-1', 'returned', '', NOW)).db;
    const req = db.requests['req-test-1'];
    expect(req?.status).toBe('returned');
    expect(req?.review?.remarks).toBe('Returned with 1 comment on the letter.');
    expect(req?.comments[0]?.sentAt).toBe(NOW.toISOString());
  });

  it('approval waits until every comment is resolved', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start));
    db = apply(db, addComment(db, OFFICER, 'req-test-1', { block: 'opening', quote: 'thesis', start: 0, body: 'Which thesis?' }, NOW, 'c1')).db;
    const blocked = decideRequest(db, OFFICER, 'req-test-1', 'approved', '', NOW);
    expect(!blocked.ok && blocked.error).toMatch(/Resolve the open comment/);
  });

  it('a hand-signed paper letter waits for the paper before approval', () => {
    const start = seedDb();
    let { db } = apply(start, submit(start, input({ signatureMethod: 'wet-paper', internSignature: '' })));
    expect(decideRequest(db, OFFICER, 'req-test-1', 'approved', '', NOW).ok).toBe(false);
    db = apply(db, setPaperCopy(db, OTHER_HR, 'req-test-1', true, NOW)).db;
    expect(decideRequest(db, OFFICER, 'req-test-1', 'approved', '', NOW).ok).toBe(true);
  });
});
