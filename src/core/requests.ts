/**
 * Every rule about a request: who is on it, which half-days it takes, the
 * duplicate guard, saving, revising, withdrawing and HR's decision. Pure
 * functions: each takes the Db and returns the changes to save. The server
 * (src/server/handlers.ts) runs them on the documents an action needs.
 *
 * Nobody files from an account: interns and employees fill in the absence
 * form, and each letter gets a code to open it again.
 */

import { openComments, sendComments } from './comments';
import { isHrOfficer } from './settings';
import { countWeekdays, currentYear, formatShortDate, minFilingDate, weekdaysBetween } from './dates';
import {
  MAX_GROUP_SIZE,
  REASON_MAX,
  REASON_MIN,
  type AbsenceRequest,
  type AbsenceType,
  type Db,
  type GroupMember,
  type HistoryEntry,
  type MemberType,
  type Outcome,
  type RequestStatus,
  type Shift,
  type SignatureMethod,
  type Slot,
  type User,
} from './types';

// ---- who is on a request ----------------------------------------------------

/** One person on the letter, the person filing first. */
export interface LetterMember {
  readonly uid: string | null;
  readonly name: string;
  readonly internId: string;
  readonly position: string;
  readonly department: string;
  readonly memberType: MemberType;
  readonly signature: string;
  readonly isFiler: boolean;
}

/** The parts of a request these rules read, so a draft still being typed can be checked too. */
export type RequestLike = Pick<
  AbsenceRequest,
  'uid' | 'snapshot' | 'memberType' | 'internSignature' | 'isGroup' | 'groupMembers' | 'type' | 'date' | 'startDate' | 'endDate' | 'shift'
>;

export function isGroupRequest(req: Pick<AbsenceRequest, 'isGroup' | 'groupMembers'>): boolean {
  return req.isGroup && req.groupMembers.length > 0;
}

export function requestMembers(req: RequestLike): LetterMember[] {
  const filer: LetterMember = {
    uid: req.uid || null,
    name: req.snapshot.name,
    internId: req.snapshot.internId,
    position: req.snapshot.position,
    department: req.snapshot.department,
    memberType: req.memberType,
    signature: req.internSignature,
    isFiler: true,
  };
  return isGroupRequest(req) ? [filer, ...req.groupMembers.map((m) => ({ ...m, isFiler: false }))] : [filer];
}

/** Everyone on the request who has an account. */
export function requestUids(req: RequestLike): string[] {
  return [...new Set(requestMembers(req).map((m) => m.uid).filter((u): u is string => Boolean(u)))];
}

/** "Juan Dela Cruz" or "Juan Dela Cruz + 2 others". */
export function namesShort(req: RequestLike): string {
  const members = requestMembers(req);
  const first = members[0]?.name ?? '';
  if (members.length === 1) return first;
  const others = members.length - 1;
  return `${first} + ${others} other${others > 1 ? 's' : ''}`;
}

export function namesAll(req: RequestLike): string {
  return requestMembers(req)
    .map((m) => m.name)
    .join(', ');
}

// ---- half-day slots and the duplicate guard ---------------------------------

/**
 * Who a half-day belongs to: their name, "name:prince-lorenz-p-lu-ang" (the
 * account's uid on older letters filed from one). '' for no name yet.
 */
export function personKey(m: { readonly uid: string | null; readonly name: string }): string {
  if (m.uid) return m.uid;
  const n = m.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return n ? `name:${n}` : '';
}

/** The person who filed it, as personKey() names them. */
export function filerKey(req: RequestLike): string {
  return personKey({ uid: req.uid || null, name: req.snapshot.name });
}

function requestPersonKeys(req: RequestLike): string[] {
  return [...new Set(requestMembers(req).map(personKey).filter(Boolean))];
}

/** The half-days one person takes: `{person}_{yyyy-mm-dd}_{am|pm}`. */
export function slotKeysFor(person: string, req: Pick<RequestLike, 'type' | 'date' | 'startDate' | 'endDate' | 'shift'>): string[] {
  if (req.type === 'full' && req.date) return [`${person}_${req.date}_am`, `${person}_${req.date}_pm`];
  if (req.type === 'half' && req.date) return [`${person}_${req.date}_${req.shift === 'afternoon' ? 'pm' : 'am'}`];
  if (req.type === 'multi') return weekdaysBetween(req.startDate, req.endDate).flatMap((d) => [`${person}_${d}_am`, `${person}_${d}_pm`]);
  return [];
}

export function allSlotKeys(req: RequestLike): string[] {
  return requestPersonKeys(req).flatMap((person) => slotKeysFor(person, req));
}

export interface Conflict {
  readonly date: string;
  readonly shift: 'AM' | 'PM';
  /** personKey() of who is double-booked. */
  readonly person: string;
  readonly personName: string;
  readonly existing: AbsenceRequest;
}

/** The first half-day someone on the request already has on another pending or approved request. */
export function findConflict(db: Db, req: RequestLike, ignoreRequestId: string | null): Conflict | null {
  for (const key of allSlotKeys(req)) {
    const slot = db.absenceSlots[key];
    if (!slot || slot.requestId === ignoreRequestId) continue;
    const other = db.requests[slot.requestId];
    if (!other || (other.status !== 'submitted' && other.status !== 'approved')) continue;
    const parts = key.split('_');
    const shift = parts.pop() === 'pm' ? 'PM' : 'AM';
    const date = parts.pop() ?? '';
    const person = parts.join('_');
    const personName = requestMembers(other).find((m) => personKey(m) === person)?.name ?? 'Someone';
    return { date, shift, person, personName, existing: other };
  }
  return null;
}

/** `viewer`: personKey() of who is looking, so their own clash reads "You already have". */
export function conflictMessage(c: Conflict, viewer: string): string {
  const who = c.person === viewer ? 'You already have' : `${c.personName} already has`;
  return `${who} ${c.existing.status === 'approved' ? 'an approved' : 'a pending'} request on ${formatShortDate(c.date)} (${c.shift}).`;
}

function slotsFor(req: AbsenceRequest): Record<string, Slot> {
  const out: Record<string, Slot> = {};
  for (const person of requestPersonKeys(req)) for (const key of slotKeysFor(person, req)) out[key] = { requestId: req.id, uid: person };
  return out;
}

/** Every half-day taken by a pending or approved request: what absenceSlots should hold. Used for the sample data. */
export function rebuildSlots(requests: Readonly<Record<string, AbsenceRequest>>): Record<string, Slot> {
  const out: Record<string, Slot> = {};
  for (const r of Object.values(requests)) if (r.status === 'submitted' || r.status === 'approved') Object.assign(out, slotsFor(r));
  return out;
}

function slotKeysOfRequest(db: Db, requestId: string): string[] {
  return Object.entries(db.absenceSlots)
    .filter(([, s]) => s.requestId === requestId)
    .map(([k]) => k);
}

// ---- the form ----------------------------------------------------------------

export interface DraftInput {
  /** "Intern or employee?" on the form: picks the letter's wording and who notes it. */
  readonly memberType: MemberType;
  /** The filer's full name. */
  readonly name: string;
  /** Prints under an employee's name. Interns: ''. */
  readonly position: string;
  readonly department: string;
  readonly type: AbsenceType;
  readonly date: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly shift: Shift;
  readonly timeRange: string;
  readonly reasonCategory: string;
  readonly reasonDetails: string;
  readonly signatureMethod: SignatureMethod;
  readonly internSignature: string;
  readonly wetCopyImage: string;
  /** "Group (same reason)" picked, even before anyone is added. */
  readonly groupMode: boolean;
  readonly groupMembers: readonly GroupMember[];
}

export const DEFAULT_TIME_RANGE: Record<Shift, string> = {
  morning: '8:00 AM – 12:00 PM',
  afternoon: '1:00 PM – 5:00 PM',
};

/** A request as the form describes it, before it is saved: what the live letter shows. */
export function buildDraft(input: DraftInput, base: AbsenceRequest | null, now: Date): AbsenceRequest {
  const department = input.department.trim();
  const groupMembers = input.groupMode
    ? input.groupMembers.map((m) => ({
        ...m,
        name: m.name.trim(),
        internId: m.internId.trim(),
        position: m.position.trim(),
        // People in a group are usually from the same department: blank means the filer's.
        department: m.department.trim() || department,
        signature: input.signatureMethod === 'digital' ? m.signature : '',
      }))
    : [];
  const days = input.type === 'half' ? 0.5 : input.type === 'multi' ? countWeekdays(input.startDate, input.endDate) : 1;
  const draft: AbsenceRequest = {
    id: base?.id ?? 'DRAFT-PREVIEW',
    refNo: base?.refNo ?? null,
    uid: base?.uid ?? '',
    accessCode: base?.accessCode ?? null,
    memberType: input.memberType,
    snapshot: {
      name: input.name.trim(),
      internId: base?.snapshot.internId ?? '',
      position: input.memberType === 'employee' ? input.position.trim() : '',
      department,
    },
    type: input.type,
    date: input.type === 'multi' ? null : input.date || null,
    startDate: input.type === 'multi' ? input.startDate || null : null,
    endDate: input.type === 'multi' ? input.endDate || null : null,
    days,
    shift: input.type === 'half' ? input.shift : null,
    timeRange: input.type === 'half' ? input.timeRange : null,
    hoursImpact: days * 8,
    reasonCategory: input.reasonCategory,
    reasonDetails: input.reasonDetails,
    signatureMethod: input.signatureMethod,
    internSignature: input.signatureMethod === 'digital' ? input.internSignature : '',
    wetCopyImage: input.signatureMethod === 'wet-upload' ? input.wetCopyImage : '',
    isGroup: groupMembers.length > 0,
    groupMembers,
    memberUids: [],
    status: base?.status ?? 'draft',
    review: base?.review ?? null,
    paperCopy: base?.paperCopy ?? null,
    history: base?.history ?? [],
    // HR's comments stay with the letter; the form never changes them.
    comments: base?.comments ?? [],
    createdAt: base?.createdAt ?? now.toISOString(),
    submittedAt: base?.submittedAt ?? null,
    updatedAt: now.toISOString(),
    templateVersion: base?.templateVersion ?? '1.0',
  };
  return { ...draft, memberUids: requestUids(draft) };
}

/** The form's values for an existing request, or a new one starting tomorrow. */
export function inputFrom(req: AbsenceRequest | null, tomorrow: string, dayAfter: string, memberType: MemberType = 'intern'): DraftInput {
  if (!req) {
    return {
      memberType,
      name: '',
      position: '',
      department: '',
      type: 'full',
      date: tomorrow,
      startDate: tomorrow,
      endDate: dayAfter,
      shift: 'morning',
      timeRange: DEFAULT_TIME_RANGE.morning,
      reasonCategory: 'Academic',
      reasonDetails: '',
      signatureMethod: 'digital',
      internSignature: '',
      wetCopyImage: '',
      groupMode: false,
      groupMembers: [],
    };
  }
  return {
    memberType: req.memberType,
    name: req.snapshot.name,
    position: req.snapshot.position,
    department: req.snapshot.department,
    type: req.type,
    date: req.date ?? tomorrow,
    startDate: req.startDate ?? tomorrow,
    endDate: req.endDate ?? dayAfter,
    shift: req.shift ?? 'morning',
    timeRange: req.timeRange ?? DEFAULT_TIME_RANGE[req.shift ?? 'morning'],
    reasonCategory: req.reasonCategory,
    reasonDetails: req.reasonDetails,
    signatureMethod: req.signatureMethod,
    internSignature: req.internSignature,
    wetCopyImage: req.wetCopyImage,
    groupMode: req.isGroup,
    groupMembers: req.groupMembers,
  };
}

// ---- saving -------------------------------------------------------------------

const REVISABLE: readonly RequestStatus[] = ['submitted', 'returned'];

/** A letter opened with its code can be changed while it waits for HR or after HR returns it. */
export function canRevise(req: AbsenceRequest | null | undefined): boolean {
  return Boolean(req?.accessCode && REVISABLE.includes(req.status));
}

/** Why the request can't be submitted yet, or null when it can. */
export function submitProblem(db: Db, draft: AbsenceRequest, input: DraftInput, editingId: string | null, now: Date): string | null {
  if (!draft.snapshot.name) return 'Enter your full name.';
  if (!draft.snapshot.department) return 'Enter your department.';
  if (draft.memberType === 'employee' && !draft.snapshot.position) return 'Enter your position. It prints under your name on the letter.';
  if (draft.type === 'multi') {
    if (!draft.startDate || !draft.endDate || draft.endDate < draft.startDate) return 'Please select a valid start date and end date.';
    if (draft.days <= 0) return 'The dates you picked contain no weekdays (Mon–Fri).';
  } else if (!draft.date) {
    return 'Please select the date of absence.';
  }
  const first = draft.type === 'multi' ? draft.startDate : draft.date;
  if (first && first < minFilingDate(now)) return 'The date cannot be more than 7 days in the past.';

  const len = draft.reasonDetails.trim().length;
  if (len < REASON_MIN || len > REASON_MAX) return `The reason must be ${REASON_MIN} to ${REASON_MAX} characters.`;

  if (input.groupMode && draft.groupMembers.length === 0) return 'Add at least one other person to the group, or choose "Just me".';
  if (requestMembers(draft).length > MAX_GROUP_SIZE) return `A group letter can have at most ${MAX_GROUP_SIZE} people.`;

  if (draft.signatureMethod === 'digital') {
    if (!draft.internSignature) return 'Your signature is required before submitting the letter.';
    const unsigned = draft.groupMembers.find((m) => !m.signature);
    if (unsigned) return `${unsigned.name} still needs to sign on their signature pad.`;
  }
  if (draft.signatureMethod === 'wet-upload' && !draft.wetCopyImage) {
    return 'Upload a photo or scan of the hand-signed letter, or choose to hand in the paper copy.';
  }

  const conflict = findConflict(db, draft, editingId);
  if (conflict) return `Duplicate blocked: ${conflictMessage(conflict, filerKey(draft))}`;
  return null;
}

// ---- letter codes ------------------------------------------------------------------

/** No 0/O or 1/I: the code is read off a screen and typed back in. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** A fresh random code: "K7Q4MZ". */
export function newAccessCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** How a code is typed back: any case, spaces or dashes. */
export function normalizeAccessCode(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "K7Q4MZ" → "K7Q-4MZ", easier to read and copy down. */
export function formatAccessCode(code: string): string {
  const c = normalizeAccessCode(code);
  return c.length === CODE_LENGTH ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

export function findByAccessCode(db: Db, typed: string): AbsenceRequest | null {
  const code = normalizeAccessCode(typed);
  if (code.length !== CODE_LENGTH) return null;
  return Object.values(db.requests).find((r) => r.accessCode === code) ?? null;
}

function uniqueAccessCode(db: Db, make: () => string): string {
  const used = new Set(Object.values(db.requests).map((r) => r.accessCode));
  for (let i = 0; i < 50; i++) {
    const code = normalizeAccessCode(make());
    if (code.length === CODE_LENGTH && !used.has(code)) return code;
  }
  throw new Error('Could not make a new letter code. Try again.');
}

// ---- saving ------------------------------------------------------------------------

export interface SaveOptions {
  readonly now: Date;
  /** The new request's id, when it isn't a revision. */
  readonly newId: string;
  /** Makes a new letter's code. The server passes one it has checked is unused; tests pass a fixed one. */
  readonly newCode?: (() => string) | undefined;
}

/**
 * Signs and sends the form to HR: a new letter (editingId null), which gets a
 * code, or a revision of the letter opened with its code. No drafts.
 */
export function saveRequest(db: Db, input: DraftInput, editingId: string | null, opts: SaveOptions): Outcome<{ id: string; accessCode: string }> {
  const existing = editingId ? db.requests[editingId] ?? null : null;
  if (editingId && !canRevise(existing)) {
    return { ok: false, error: 'This letter was already decided by HR and can no longer be changed.' };
  }
  if (input.groupMode && input.groupMembers.some((m) => !m.name.trim())) {
    return { ok: false, error: 'Enter the name of every person in the group (or remove the empty row).' };
  }

  const draft = buildDraft(input, existing, opts.now);
  const problem = submitProblem(db, draft, input, editingId, opts.now);
  if (problem) return { ok: false, error: problem };

  const nowIso = opts.now.toISOString();
  const id = existing?.id ?? opts.newId;
  let accessCode = existing?.accessCode ?? null;
  if (!accessCode) {
    try {
      accessCode = uniqueAccessCode(db, opts.newCode ?? newAccessCode);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  const remarks =
    existing?.status === 'returned'
      ? 'Revised and resubmitted letter.'
      : existing?.status === 'submitted'
        ? 'Edited while waiting for HR review.'
        : 'Submitted through the absence form.';
  const entry: HistoryEntry = { status: 'submitted', byUid: '', byName: draft.snapshot.name, remarks, at: nowIso };

  const saved: AbsenceRequest = {
    ...draft,
    id,
    accessCode,
    status: 'submitted',
    review: existing?.review ?? null,
    // Paper copy tracking for hand-signed letters handed in to HR. Any edit means a new paper.
    paperCopy: draft.signatureMethod === 'wet-paper' ? { status: 'awaiting', receivedAt: null, receivedByName: null } : null,
    history: [...(existing?.history ?? []), entry],
    createdAt: existing?.createdAt ?? nowIso,
    submittedAt: nowIso,
    updatedAt: nowIso,
    templateVersion: db.settings.letter.templateVersion,
  };

  return {
    ok: true,
    value: { id, accessCode },
    message: existing?.status === 'submitted' ? 'Changes saved. HR will see the updated letter.' : 'Letter signed and sent to HR.',
    changes: {
      requests: [saved],
      deleteSlots: existing ? slotKeysOfRequest(db, id) : [],
      putSlots: slotsFor(saved),
    },
  };
}

/** The person who opened the letter with its code takes it back before HR decides. */
export function withdrawRequest(db: Db, id: string, now: Date): Outcome {
  const req = db.requests[id];
  if (!req || req.status !== 'submitted' || !req.accessCode) return { ok: false, error: 'Only a letter still waiting for HR can be withdrawn.' };
  const at = now.toISOString();
  return {
    ok: true,
    value: undefined,
    message: 'Request withdrawn. Its dates are free again.',
    changes: {
      requests: [
        {
          ...req,
          status: 'withdrawn',
          updatedAt: at,
          history: [...req.history, { status: 'withdrawn', byUid: '', byName: req.snapshot.name, remarks: 'Withdrawn before HR review.', at }],
        },
      ],
      deleteSlots: slotKeysOfRequest(db, id),
    },
  };
}

// ---- HR -----------------------------------------------------------------------

export function isAwaitingPaperCopy(req: AbsenceRequest): boolean {
  return req.signatureMethod === 'wet-paper' && req.paperCopy?.status !== 'received';
}

export function setPaperCopy(db: Db, hr: User, id: string, received: boolean, now: Date): Outcome {
  const req = db.requests[id];
  if (!req || hr.role !== 'hr') return { ok: false, error: 'Only HR can do that.' };
  const at = now.toISOString();
  return {
    ok: true,
    value: undefined,
    message: received ? 'Paper copy marked as received. You can now approve.' : 'Paper copy set back to waiting.',
    changes: {
      requests: [
        {
          ...req,
          paperCopy: received ? { status: 'received', receivedAt: at, receivedByName: hr.name } : { status: 'awaiting', receivedAt: null, receivedByName: null },
          updatedAt: at,
          history: [
            ...req.history,
            {
              status: req.status,
              byUid: hr.uid,
              byName: hr.name,
              remarks: received ? 'Hand-signed paper copy received.' : 'Paper copy marked as not yet received.',
              at,
            },
          ],
        },
      ],
    },
  };
}

export type Decision = 'approved' | 'returned' | 'declined';

export function decideRequest(db: Db, hr: User, id: string, decision: Decision, remarksIn: string, now: Date): Outcome {
  const req = db.requests[id];
  if (!req || hr.role !== 'hr') return { ok: false, error: 'Only HR can do that.' };
  if (req.status !== 'submitted') return { ok: false, error: 'This request is no longer waiting for a decision.' };
  if (decision === 'approved' && !isHrOfficer(db.settings.letter, hr)) {
    return {
      ok: false,
      error: db.settings.letter.hrOfficerEmail
        ? 'Only the HR officer named in Settings can approve and sign letters. You can comment, return or decline.'
        : 'Name the HR officer in Settings first: only that account can approve and sign letters.',
    };
  }
  if (decision === 'approved' && isAwaitingPaperCopy(req)) return { ok: false, error: 'Mark the hand-signed paper copy as received before approving.' };
  const open = openComments(req);
  if (decision === 'approved' && open.length > 0) {
    return { ok: false, error: `Resolve the ${open.length === 1 ? 'open comment' : `${open.length} open comments`} on the letter before approving.` };
  }
  // Returning with comments on the letter says what to fix: remarks are then optional.
  const remarks = remarksIn.trim() || (decision === 'returned' && open.length > 0 ? `Returned with ${open.length} comment${open.length === 1 ? '' : 's'} on the letter.` : '');
  if (decision !== 'approved' && !remarks) {
    return { ok: false, error: decision === 'returned' ? 'Add a comment on the letter or write remarks saying what to fix.' : 'Remarks are required when a request is declined.' };
  }

  const at = now.toISOString();
  if (decision === 'approved') {
    // The next reference number for the year, taken in the same save as the approval.
    const year = currentYear(now);
    // The counter, or past the highest number already on a letter if the counter fell behind.
    const used = Object.values(db.requests)
      .map((r) => r.refNo?.match(new RegExp(`^APG-EL-${year}-(\d+)$`))?.[1])
      .reduce((max, n) => Math.max(max, n ? Number(n) : 0), 0);
    const seq = Math.max(db.counters[year]?.nextRefNo ?? 1, used + 1);
    const refNo = `APG-EL-${year}-${String(seq).padStart(4, '0')}`;
    const review = { byUid: hr.uid, byName: hr.name, remarks: remarks || 'Approved.', at, hrSignature: db.settings.letter.hrSignature };
    return {
      ok: true,
      value: undefined,
      message: `Approved. Reference no. ${refNo} assigned and HR signature added.`,
      changes: {
        counters: { [year]: { nextRefNo: seq + 1 } },
        requests: [
          { ...req, refNo, status: 'approved', review, updatedAt: at, history: [...req.history, { status: 'approved', byUid: hr.uid, byName: hr.name, remarks: review.remarks, at }] },
        ],
      },
    };
  }
  const review = { byUid: hr.uid, byName: hr.name, remarks, at, hrSignature: null };
  return {
    ok: true,
    value: undefined,
    message: decision === 'returned' ? 'Returned for revision.' : 'Request declined.',
    changes: {
      requests: [
        {
          ...req,
          status: decision,
          review,
          // HR's draft comments go to the member with the letter.
          comments: sendComments(req.comments, at),
          updatedAt: at,
          history: [...req.history, { status: decision, byUid: hr.uid, byName: hr.name, remarks, at }],
        },
      ],
      // Returned or declined frees the dates, so the person can file again or revise.
      deleteSlots: slotKeysOfRequest(db, id),
    },
  };
}

// ---- ids ------------------------------------------------------------------------

export function newRequestId(now: Date): string {
  return `req-${currentYear(now)}-${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
