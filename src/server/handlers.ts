/**
 * Everything the server does, on top of the rules in src/core. Two doors:
 *
 *   - publicCall: the absence form and the letter code, no sign-in. Anyone can
 *     call it, so each call only ever reaches the one letter its code opens.
 *   - hrCall: HR, signed in. Every account on the project is HR.
 *
 * Each action reads only the documents it needs inside one transaction, builds
 * a small Db of them, runs the same rule the app used to run on its whole
 * SQLite file, and writes that rule's changes. The Cloud Functions
 * (firebase/functions) and the local stand-in for `npm run dev`
 * (src/backend/local.ts) both call these, so the rules exist once.
 */

import { addComment, deleteComment, editComment, newCommentId, resolveComments } from '@/core/comments';
import { normalizeSettings } from '@/core/db';
import {
  allSlotKeys,
  buildDraft,
  CODE_LENGTH,
  decideRequest,
  newAccessCode,
  newRequestId,
  normalizeAccessCode,
  saveRequest,
  setPaperCopy,
  withdrawRequest,
  type Decision,
} from '@/core/requests';
import { isHrOfficer, mayEditSettings, saveLetterSettings } from '@/core/settings';
import type { AbsenceRequest, Changes, Db, Outcome, Settings, User } from '@/core/types';
import { Invalid, parseCode, parseDraftInput, parseId, parseNewComment, parseSettingsInput } from './parse';
import type { Store, Tx } from './store';

// ---- what goes over the wire ---------------------------------------------------

/** A handler's answer. A refusal is an answer too, with the sentence to show. */
export type Reply<T = unknown> =
  | { readonly ok: true; readonly message: string; readonly value: T; readonly changes?: Changes }
  | { readonly ok: false; readonly error: string; readonly notFound?: true };

/** A letter as its own filer sees it: HR's comments only once they were sent with the letter. */
export function memberView(req: AbsenceRequest): AbsenceRequest {
  return { ...req, comments: req.comments.filter((c) => c.sentAt) };
}

/** The settings anyone may read: what the letter prints, without HR's signature or the officer's email. */
export function publicSettings(settings: Settings): Settings {
  return { letter: { ...settings.letter, hrSignature: '', hrOfficerEmail: '' } };
}

export interface LetterReply {
  readonly code: string;
  readonly letter: AbsenceRequest;
}

export interface HrData {
  readonly requests: readonly AbsenceRequest[];
  readonly settings: Settings;
  readonly isOfficer: boolean;
  readonly mayEditSettings: boolean;
}

/** Fresh ids and codes. Tests pass fixed ones. */
export interface Ids {
  requestId(now: Date): string;
  code(): string;
  commentId(now: Date): string;
}

export const RANDOM_IDS: Ids = { requestId: newRequestId, code: newAccessCode, commentId: newCommentId };

const NOT_FOUND = "There's no letter with that code. Check it and try again.";

/** A Firestore document holds at most 1 MiB; a letter is kept a little under that, photo and signatures included. */
export const MAX_LETTER_SIZE = 1_000_000;
/** The longest absence one letter covers: about three months of weekdays. Longer leave goes through HR. */
export const MAX_DAYS = 60;

function tooBig(changes: Changes): string | null {
  for (const r of changes.requests ?? []) {
    if (JSON.stringify(r).length > MAX_LETTER_SIZE) {
      return 'This letter is too large to save. Use a smaller photo of the signed letter, or fewer drawn signatures.';
    }
  }
  return null;
}

function tooLong(draft: AbsenceRequest): string | null {
  return draft.days > MAX_DAYS ? `One letter can cover at most ${MAX_DAYS} weekdays. For a longer leave, talk to HR.` : null;
}

function refuse(error: string): Reply<never> {
  return { ok: false, error };
}

/** HR's answer: the rule's changes are written, and sent back for HR's screen to apply. */
function commit<T>(out: Outcome<T>, tx: Tx): Reply<T> {
  if (!out.ok) return refuse(out.error);
  const big = tooBig(out.changes);
  if (big) return refuse(big);
  tx.write(out.changes);
  return { ok: true, message: out.message, value: out.value, changes: out.changes };
}

/** The form's answer: written, and the letter sent back as its filer sees it (no other changes leave the server). */
function commitLetter(out: Outcome<unknown>, tx: Tx, code: string, fallback: AbsenceRequest): Reply<LetterReply> {
  if (!out.ok) return refuse(out.error);
  const big = tooBig(out.changes);
  if (big) return refuse(big);
  tx.write(out.changes);
  const saved = out.changes.requests?.find((r) => r.id === fallback.id) ?? out.changes.requests?.[0] ?? fallback;
  return { ok: true, message: out.message, value: { code, letter: memberView(saved) } };
}

/** A small Db holding only what was read. */
function partialDb(parts: Partial<Db> & Pick<Db, 'settings'>): Db {
  return { requests: {}, absenceSlots: {}, counters: {}, ...parts };
}

async function readSettings(tx: Tx): Promise<Settings> {
  return normalizeSettings(await tx.settings());
}

/** The letters holding any of these half-days, so the duplicate guard can say whose they are. */
async function holders(tx: Tx, slots: Db['absenceSlots']): Promise<Record<string, AbsenceRequest>> {
  const out: Record<string, AbsenceRequest> = {};
  for (const id of new Set(Object.values(slots).map((s) => s.requestId))) {
    const req = await tx.request(id);
    if (req) out[id] = req;
  }
  return out;
}

function codeOf(raw: unknown): string | null {
  const code = normalizeAccessCode(parseCode(raw));
  return code.length === CODE_LENGTH ? code : null;
}

async function unusedCode(tx: Tx, ids: Ids): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = normalizeAccessCode(ids.code());
    if (code.length === CODE_LENGTH && !(await tx.requestByCode(code))) return code;
  }
  throw new Error('Could not make a new letter code. Try again.');
}

function field(call: Record<string, unknown>, key: string): unknown {
  return call[key];
}

function asCall(raw: unknown): { action: string; call: Record<string, unknown> } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Invalid('Nothing was sent.');
  const call = raw as Record<string, unknown>;
  if (typeof call.action !== 'string') throw new Invalid('Nothing was asked.');
  return { action: call.action, call };
}

// ---- the absence form and the letter code, no sign-in ------------------------------

export type PublicCall =
  | { readonly action: 'settings' }
  | { readonly action: 'submit'; readonly input: unknown }
  | { readonly action: 'open'; readonly code: string }
  | { readonly action: 'revise'; readonly code: string; readonly input: unknown }
  | { readonly action: 'withdraw'; readonly code: string };

export async function publicCall(store: Store, raw: unknown, now: Date, ids: Ids = RANDOM_IDS): Promise<Reply> {
  try {
    const { action, call } = asCall(raw);
    switch (action) {
      case 'settings':
        return { ok: true, message: '', value: publicSettings(normalizeSettings(await store.settings())) };

      case 'submit': {
        const input = parseDraftInput(field(call, 'input'));
        return await store.transaction(async (tx): Promise<Reply<LetterReply>> => {
          const draft = buildDraft(input, null, now);
          const long = tooLong(draft);
          if (long) return refuse(long);
          const slots = await tx.slots(allSlotKeys(draft));
          const requests = await holders(tx, slots);
          const code = await unusedCode(tx, ids);
          const settings = await readSettings(tx);
          const id = ids.requestId(now);
          const out = saveRequest(partialDb({ requests, absenceSlots: slots, settings }), input, null, { now, newId: id, newCode: () => code });
          return commitLetter(out, tx, code, { ...draft, id, accessCode: code });
        });
      }

      case 'open': {
        const code = codeOf(field(call, 'code'));
        if (!code) return { ok: false, error: NOT_FOUND, notFound: true };
        return await store.transaction(async (tx): Promise<Reply<LetterReply>> => {
          const req = await tx.requestByCode(code);
          return req ? { ok: true, message: '', value: { code, letter: memberView(req) } } : { ok: false, error: NOT_FOUND, notFound: true };
        });
      }

      case 'revise': {
        const code = codeOf(field(call, 'code'));
        const input = parseDraftInput(field(call, 'input'));
        if (!code) return { ok: false, error: NOT_FOUND, notFound: true };
        return await store.transaction(async (tx): Promise<Reply<LetterReply>> => {
          const existing = await tx.requestByCode(code);
          if (!existing) return { ok: false, error: NOT_FOUND, notFound: true };
          const own = await tx.slotsOf(existing.id);
          const draft = buildDraft(input, existing, now);
          const long = tooLong(draft);
          if (long) return refuse(long);
          const slots = await tx.slots(allSlotKeys(draft));
          const requests = { ...(await holders(tx, slots)), [existing.id]: existing };
          const settings = await readSettings(tx);
          const out = saveRequest(partialDb({ requests, absenceSlots: { ...own, ...slots }, settings }), input, existing.id, { now, newId: existing.id });
          return commitLetter(out, tx, code, existing);
        });
      }

      case 'withdraw': {
        const code = codeOf(field(call, 'code'));
        if (!code) return { ok: false, error: NOT_FOUND, notFound: true };
        return await store.transaction(async (tx): Promise<Reply<LetterReply>> => {
          const existing = await tx.requestByCode(code);
          if (!existing) return { ok: false, error: NOT_FOUND, notFound: true };
          const own = await tx.slotsOf(existing.id);
          const settings = await readSettings(tx);
          const out = withdrawRequest(partialDb({ requests: { [existing.id]: existing }, absenceSlots: own, settings }), existing.id, now);
          return commitLetter(out, tx, code, existing);
        });
      }

      default:
        return refuse('Unknown request.');
    }
  } catch (err) {
    if (err instanceof Invalid) return refuse(err.message);
    throw err;
  }
}

// ---- HR, signed in ----------------------------------------------------------------

export type HrCall =
  | { readonly action: 'load' }
  | { readonly action: 'decide'; readonly id: string; readonly decision: Decision; readonly remarks: string }
  | { readonly action: 'paper'; readonly id: string; readonly received: boolean }
  | { readonly action: 'addComment'; readonly id: string; readonly comment: unknown }
  | { readonly action: 'editComment'; readonly id: string; readonly commentId: string; readonly body: string }
  | { readonly action: 'deleteComment'; readonly id: string; readonly commentId: string }
  | { readonly action: 'resolveComments'; readonly id: string; readonly ids: readonly string[] | null; readonly resolved: boolean }
  | { readonly action: 'saveSettings'; readonly settings: unknown };

/** One letter, the half-days it holds, the settings and the counters: what HR's actions on a letter need. */
async function letterDb(tx: Tx, id: string): Promise<Db | null> {
  const req = await tx.request(id);
  if (!req) return null;
  return partialDb({ requests: { [id]: req }, absenceSlots: await tx.slotsOf(id), settings: await readSettings(tx), counters: await tx.counters() });
}

function bool(v: unknown, what: string): boolean {
  if (typeof v !== 'boolean') throw new Invalid(`${what} is missing.`);
  return v;
}

function textIn(v: unknown, what: string, max: number): string {
  if (typeof v !== 'string' || v.length > max) throw new Invalid(`${what} is missing or too long.`);
  return v;
}

export async function hrCall(store: Store, hr: User, raw: unknown, now: Date, ids: Ids = RANDOM_IDS): Promise<Reply> {
  try {
    const { action, call } = asCall(raw);
    if (action === 'load') {
      const settings = normalizeSettings(await store.settings());
      const value: HrData = {
        requests: await store.allRequests(),
        settings,
        isOfficer: isHrOfficer(settings.letter, hr),
        mayEditSettings: mayEditSettings(settings.letter, hr),
      };
      return { ok: true, message: '', value };
    }

    if (action === 'saveSettings') {
      const input = parseSettingsInput(field(call, 'settings'));
      return await store.transaction(async (tx) => {
        const settings = await readSettings(tx);
        return commit(saveLetterSettings(partialDb({ settings }), hr, input), tx);
      });
    }

    const id = parseId(field(call, 'id'));
    return await store.transaction(async (tx): Promise<Reply> => {
      const db = await letterDb(tx, id);
      if (!db) return refuse('That letter is gone.');
      switch (action) {
        case 'decide': {
          const decision = ['approved', 'returned', 'declined'].find((d) => d === field(call, 'decision')) as Decision | undefined;
          if (!decision) throw new Invalid('Approve, return or decline?');
          return commit(decideRequest(db, hr, id, decision, textIn(field(call, 'remarks') ?? '', 'The remarks', 2000), now), tx);
        }
        case 'paper':
          return commit(setPaperCopy(db, hr, id, bool(field(call, 'received'), 'Received'), now), tx);
        case 'addComment': {
          return commit(addComment(db, hr, id, parseNewComment(field(call, 'comment')), now, ids.commentId(now)), tx);
        }
        case 'editComment':
          return commit(editComment(db, hr, id, parseId(field(call, 'commentId'), 'The comment'), textIn(field(call, 'body'), 'The comment', 2000), now), tx);
        case 'deleteComment':
          return commit(deleteComment(db, hr, id, parseId(field(call, 'commentId'), 'The comment'), now), tx);
        case 'resolveComments': {
          const raw = field(call, 'ids');
          const which = raw === null ? null : Array.isArray(raw) ? raw.map((c) => parseId(c, 'The comment')) : null;
          if (raw !== null && which === null) throw new Invalid('Which comments?');
          return commit(resolveComments(db, hr, id, which, bool(field(call, 'resolved'), 'Resolved'), now), tx);
        }
        default:
          return refuse('Unknown request.');
      }
    });
  } catch (err) {
    if (err instanceof Invalid) return refuse(err.message);
    throw err;
  }
}
