import { describe, expect, it } from 'vitest';
import { addComment, deleteComment, editComment, locateQuote, memberComments, openComments, resolveComments, type NewComment } from './comments';
import { applyChanges } from './db';
import { seedDb } from './seed';
import type { Db, Outcome, User } from './types';

const NOW = new Date(2026, 10, 12, 9, 0, 0);
/** req-2026-005 in the sample data: an intern's letter waiting for HR. */
const WAITING = 'req-2026-005';
const NEW: NewComment = { block: 'opening', quote: 'diagnostic procedure', start: 120, body: 'Please say what time the procedure is.' };

function apply<T>(db: Db, outcome: Outcome<T>): Db {
  if (!outcome.ok) throw new Error(outcome.error);
  return applyChanges(db, outcome.changes);
}

/** Any HR account comments; the sample data's HR officer is one. */
function hr(_db: Db): User {
  return { uid: 'hr-chico', name: 'Ms. Jean Ashley Chico', email: 'chico@apg-letters.test', role: 'hr' };
}

describe('finding a comment’s words on the letter', () => {
  const text = 'I am respectfully requesting permission to take a leave of absence on Friday as I have a dental appointment.';

  it('finds them where they were', () => {
    const start = text.indexOf('dental appointment');
    expect(locateQuote(text, 'dental appointment', start)).toEqual({ start, end: start + 'dental appointment'.length });
  });

  it('follows them when the text before them changed', () => {
    const moved = text.replace('Friday', 'Friday, November 20, 2026,');
    const at = locateQuote(moved, 'dental appointment', text.indexOf('dental appointment'));
    expect(at && moved.slice(at.start, at.end)).toBe('dental appointment');
  });

  it('takes the nearest copy when the words appear twice', () => {
    const twice = 'on the morning of Monday and on the morning of Tuesday';
    expect(locateQuote(twice, 'morning', 40)?.start).toBe(twice.lastIndexOf('morning'));
    expect(locateQuote(twice, 'morning', 0)?.start).toBe(twice.indexOf('morning'));
  });

  it('says so when the words were rewritten', () => {
    expect(locateQuote(text, 'eye check-up', 80)).toBeNull();
  });
});

describe('HR commenting on a letter', () => {
  it('adds a draft comment the member does not see yet', () => {
    const start = seedDb();
    const db = apply(start, addComment(start, hr(start), WAITING, NEW, NOW, 'c1'));
    const req = db.requests[WAITING];
    expect(req?.comments).toHaveLength(1);
    expect(req?.comments[0]).toMatchObject({ id: 'c1', block: 'opening', quote: 'diagnostic procedure', sentAt: null, resolvedAt: null, byName: 'Ms. Jean Ashley Chico' });
    expect(req && openComments(req)).toHaveLength(1);
    expect(req && memberComments(req)).toHaveLength(0);
  });

  it('only HR, only on a waiting letter, and never an empty comment', () => {
    const db = seedDb();
    // Only HR ever signs in; an account of any other kind (none exists now) is refused.
    const notHr = { ...hr(db), role: 'intern' } as unknown as User;
    expect(addComment(db, notHr, WAITING, NEW, NOW, 'c1').ok).toBe(false);
    expect(addComment(db, hr(db), 'req-2026-001', NEW, NOW, 'c1').ok).toBe(false);
    expect(addComment(db, hr(db), WAITING, { ...NEW, body: '   ' }, NOW, 'c1').ok).toBe(false);
    expect(addComment(db, hr(db), WAITING, { ...NEW, quote: '  ' }, NOW, 'c1').ok).toBe(false);
  });

  it('edits or deletes a draft, but not a comment the member has seen', () => {
    const start = seedDb();
    let db = apply(start, addComment(start, hr(start), WAITING, NEW, NOW, 'c1'));
    db = apply(db, editComment(db, hr(db), WAITING, 'c1', 'Give the exact time.', NOW));
    expect(db.requests[WAITING]?.comments[0]?.body).toBe('Give the exact time.');
    db = apply(db, deleteComment(db, hr(db), WAITING, 'c1', NOW));
    expect(db.requests[WAITING]?.comments).toHaveLength(0);

    // The sample returned letter's comments were sent: after it is resubmitted HR can resolve them, not edit them.
    const sent = seedDb();
    const req = sent.requests['req-2026-004'];
    if (!req) throw new Error('no returned letter');
    const resubmitted = applyChanges(sent, { requests: [{ ...req, status: 'submitted' }] });
    expect(editComment(resubmitted, hr(resubmitted), req.id, 'c-seed-1', 'x', NOW).ok).toBe(false);
    expect(deleteComment(resubmitted, hr(resubmitted), req.id, 'c-seed-1', NOW).ok).toBe(false);
    const resolved = apply(resubmitted, resolveComments(resubmitted, hr(resubmitted), req.id, ['c-seed-1'], true, NOW));
    const after = resolved.requests[req.id];
    expect(after?.comments.find((c) => c.id === 'c-seed-1')?.resolvedByName).toBe('Ms. Jean Ashley Chico');
    expect(after && openComments(after).map((c) => c.id)).toEqual(['c-seed-2']);
    expect(after && memberComments(after).map((c) => c.id)).toEqual(['c-seed-2']);
  });

  it('does not resolve a new comment the member never saw: HR deletes it instead', () => {
    const start = seedDb();
    const db = apply(start, addComment(start, hr(start), WAITING, NEW, NOW, 'c1'));
    expect(resolveComments(db, hr(db), WAITING, ['c1'], true, NOW).ok).toBe(false);
    expect(resolveComments(db, hr(db), WAITING, null, true, NOW).ok).toBe(false);
  });

  it('resolves every open comment at once, and opens one again', () => {
    const sent = seedDb();
    const req = sent.requests['req-2026-004'];
    if (!req) throw new Error('no returned letter');
    let db = applyChanges(sent, { requests: [{ ...req, status: 'submitted' }] });
    db = apply(db, resolveComments(db, hr(db), req.id, null, true, NOW));
    expect(db.requests[req.id] && openComments(db.requests[req.id] ?? req)).toHaveLength(0);
    db = apply(db, resolveComments(db, hr(db), req.id, ['c-seed-2'], false, NOW));
    expect(openComments(db.requests[req.id] ?? req).map((c) => c.id)).toEqual(['c-seed-2']);
  });
});
