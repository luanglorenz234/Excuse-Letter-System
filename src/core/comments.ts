/**
 * HR's comments on a letter, like Google Docs comments: HR highlights words
 * in one block of the letter and writes a note beside them. They stay HR's
 * draft until the letter goes back (returned or declined), then the member
 * sees them, revises, and HR resolves each one on the next review.
 *
 * The letter is rebuilt from the request every time, so a comment remembers
 * its words and where they started rather than a place in the page; when the
 * member rewrites those words the comment says so instead of pointing at the
 * wrong text.
 */

import { COMMENT_MAX, LETTER_BLOCKS, type AbsenceRequest, type Db, type LetterBlock, type LetterComment, type Outcome, type User } from './types';

/** Comments HR still has to deal with: not resolved, sent or not. */
export function openComments(req: Pick<AbsenceRequest, 'comments'>): LetterComment[] {
  return req.comments.filter((c) => !c.resolvedAt);
}

/** What the member sees: comments that went back with the letter and aren't resolved. */
export function memberComments(req: Pick<AbsenceRequest, 'comments'>): LetterComment[] {
  return req.comments.filter((c) => c.sentAt && !c.resolvedAt);
}

/** Where a comment's words are in its block's text now, or null when the text was changed. */
export function locateQuote(text: string, quote: string, start: number): { start: number; end: number } | null {
  if (!quote) return null;
  if (text.slice(start, start + quote.length) === quote) return { start, end: start + quote.length };
  // The words moved (text before them changed): take the nearest copy of them.
  let best: number | null = null;
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
    if (best === null || Math.abs(i - start) < Math.abs(best - start)) best = i;
  }
  return best === null ? null : { start: best, end: best + quote.length };
}

export interface NewComment {
  readonly block: LetterBlock;
  readonly quote: string;
  readonly start: number;
  readonly body: string;
}

function commentable(db: Db, hr: User, requestId: string): { ok: true; req: AbsenceRequest } | { ok: false; error: string } {
  const req = db.requests[requestId];
  if (!req || hr.role !== 'hr') return { ok: false, error: 'Only HR can comment on a letter.' };
  if (req.status !== 'submitted') return { ok: false, error: 'You can only comment on a letter that is waiting for review.' };
  return { ok: true, req };
}

function cleanBody(body: string): string | { error: string } {
  const text = body.trim();
  if (!text) return { error: 'Write the comment first.' };
  if (text.length > COMMENT_MAX) return { error: `A comment can be at most ${COMMENT_MAX} characters.` };
  return text;
}

function withComments(req: AbsenceRequest, comments: readonly LetterComment[], at: string): AbsenceRequest {
  return { ...req, comments, updatedAt: at };
}

export function addComment(db: Db, hr: User, requestId: string, input: NewComment, now: Date, newId: string): Outcome<{ id: string }> {
  const check = commentable(db, hr, requestId);
  if (!check.ok) return check;
  const body = cleanBody(input.body);
  if (typeof body !== 'string') return { ok: false, error: body.error };
  // The quote is kept exactly as selected: it is matched against the letter's text later.
  if (!input.quote.trim() || !LETTER_BLOCKS.includes(input.block)) return { ok: false, error: 'Select the words on the letter you want to comment on.' };
  const at = now.toISOString();
  const comment: LetterComment = {
    id: newId,
    block: input.block,
    quote: input.quote,
    start: Math.max(0, Math.floor(input.start)),
    body,
    byUid: hr.uid,
    byName: hr.name,
    at,
    sentAt: null,
    resolvedAt: null,
    resolvedByName: null,
  };
  return {
    ok: true,
    value: { id: newId },
    message: 'Comment added. The member sees it when you return the letter.',
    changes: { requests: [withComments(check.req, [...check.req.comments, comment], at)] },
  };
}

/** HR changes the words of a comment the member hasn't seen yet. */
export function editComment(db: Db, hr: User, requestId: string, commentId: string, bodyIn: string, now: Date): Outcome {
  const check = commentable(db, hr, requestId);
  if (!check.ok) return check;
  const target = check.req.comments.find((c) => c.id === commentId);
  if (!target) return { ok: false, error: 'That comment is gone.' };
  if (target.sentAt) return { ok: false, error: 'The member has already seen this comment. Resolve it and add a new one instead.' };
  const body = cleanBody(bodyIn);
  if (typeof body !== 'string') return { ok: false, error: body.error };
  const at = now.toISOString();
  return {
    ok: true,
    value: undefined,
    message: 'Comment updated.',
    changes: { requests: [withComments(check.req, check.req.comments.map((c) => (c.id === commentId ? { ...c, body } : c)), at)] },
  };
}

/** HR removes a comment the member hasn't seen yet. Sent ones are resolved instead, so the record stays. */
export function deleteComment(db: Db, hr: User, requestId: string, commentId: string, now: Date): Outcome {
  const check = commentable(db, hr, requestId);
  if (!check.ok) return check;
  const target = check.req.comments.find((c) => c.id === commentId);
  if (!target) return { ok: false, error: 'That comment is gone.' };
  if (target.sentAt) return { ok: false, error: 'The member has already seen this comment. Resolve it instead.' };
  const at = now.toISOString();
  return {
    ok: true,
    value: undefined,
    message: 'Comment deleted.',
    changes: { requests: [withComments(check.req, check.req.comments.filter((c) => c.id !== commentId), at)] },
  };
}

/** HR marks comments as dealt with (or opens one again). `ids` null: every open comment. */
export function resolveComments(db: Db, hr: User, requestId: string, ids: readonly string[] | null, resolved: boolean, now: Date): Outcome {
  const check = commentable(db, hr, requestId);
  if (!check.ok) return check;
  const at = now.toISOString();
  // Only comments the member has seen: a new one that was never sent is deleted instead.
  const picked = (c: LetterComment) => Boolean(c.sentAt) && (ids === null ? !c.resolvedAt : ids.includes(c.id));
  const count = check.req.comments.filter(picked).length;
  if (count === 0) return { ok: false, error: 'There is no comment to change.' };
  const comments = check.req.comments.map((c) =>
    picked(c) ? (resolved ? { ...c, resolvedAt: at, resolvedByName: hr.name } : { ...c, resolvedAt: null, resolvedByName: null }) : c,
  );
  return {
    ok: true,
    value: undefined,
    message: resolved ? (count === 1 ? 'Comment resolved.' : `${count} comments resolved.`) : 'Comment opened again.',
    changes: { requests: [withComments(check.req, comments, at)] },
  };
}

/** Every comment the member hasn't seen yet, marked as sent: done when HR returns or declines the letter. */
export function sendComments(comments: readonly LetterComment[], at: string): LetterComment[] {
  return comments.map((c) => (c.sentAt ? c : { ...c, sentAt: at }));
}

export function newCommentId(now: Date): string {
  return `c-${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
