/**
 * Every rule about a request: who is on it, which half-days it takes, the
 * duplicate guard, saving, editing, withdrawing and HR's decision. Pure
 * functions: each takes the Db and returns the changes to save, so the rules
 * can move to a Cloud Function later as they are.
 */

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
    uid: req.uid,
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

export function includesUser(req: RequestLike, uid: string): boolean {
  return requestUids(req).includes(uid);
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

/** The half-days one person takes: `{uid}_{yyyy-mm-dd}_{am|pm}`. */
export function slotKeysFor(uid: string, req: Pick<RequestLike, 'type' | 'date' | 'startDate' | 'endDate' | 'shift'>): string[] {
  if (req.type === 'full' && req.date) return [`${uid}_${req.date}_am`, `${uid}_${req.date}_pm`];
  if (req.type === 'half' && req.date) return [`${uid}_${req.date}_${req.shift === 'afternoon' ? 'pm' : 'am'}`];
  if (req.type === 'multi') return weekdaysBetween(req.startDate, req.endDate).flatMap((d) => [`${uid}_${d}_am`, `${uid}_${d}_pm`]);
  return [];
}

export function allSlotKeys(req: RequestLike): string[] {
  return requestUids(req).flatMap((uid) => slotKeysFor(uid, req));
}

export interface Conflict {
  readonly date: string;
  readonly shift: 'AM' | 'PM';
  readonly personUid: string;
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
    const personUid = parts.join('_');
    return { date, shift, personUid, personName: db.users[personUid]?.name ?? 'Someone', existing: other };
  }
  return null;
}

export function conflictMessage(c: Conflict, viewerUid: string): string {
  const who = c.personUid === viewerUid ? 'You already have' : `${c.personName} already has`;
  return `${who} ${c.existing.status === 'approved' ? 'an approved' : 'a pending'} request on ${formatShortDate(c.date)} (${c.shift}).`;
}

function slotsFor(req: AbsenceRequest): Record<string, Slot> {
  const out: Record<string, Slot> = {};
  for (const uid of requestUids(req)) for (const key of slotKeysFor(uid, req)) out[key] = { requestId: req.id, uid };
  return out;
}

function slotKeysOfRequest(db: Db, requestId: string): string[] {
  return Object.entries(db.absenceSlots)
    .filter(([, s]) => s.requestId === requestId)
    .map(([k]) => k);
}

// ---- the form ----------------------------------------------------------------

export interface DraftInput {
  readonly memberType: MemberType;
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
export function buildDraft(input: DraftInput, user: User, base: AbsenceRequest | null, now: Date): AbsenceRequest {
  const groupMembers = input.groupMode
    ? input.groupMembers.map((m) => ({
        ...m,
        name: m.name.trim(),
        internId: m.internId.trim(),
        position: m.position.trim(),
        signature: input.signatureMethod === 'digital' ? m.signature : '',
      }))
    : [];
  const days = input.type === 'half' ? 0.5 : input.type === 'multi' ? countWeekdays(input.startDate, input.endDate) : 1;
  const draft: AbsenceRequest = {
    id: base?.id ?? 'DRAFT-PREVIEW',
    refNo: base?.refNo ?? null,
    uid: user.uid,
    memberType: input.memberType,
    snapshot: { name: user.name, internId: user.internId, position: user.position, department: user.department },
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
    createdAt: base?.createdAt ?? now.toISOString(),
    submittedAt: base?.submittedAt ?? null,
    updatedAt: now.toISOString(),
    templateVersion: base?.templateVersion ?? '1.0',
  };
  return { ...draft, memberUids: requestUids(draft) };
}

/** The form's values for an existing request, or a new one starting tomorrow. */
export function inputFrom(req: AbsenceRequest | null, user: User, tomorrow: string, dayAfter: string): DraftInput {
  if (!req) {
    return {
      memberType: user.role === 'employee' ? 'employee' : 'intern',
      type: 'full',
      date: tomorrow,
      startDate: tomorrow,
      endDate: dayAfter,
      shift: 'morning',
      timeRange: DEFAULT_TIME_RANGE.morning,
      reasonCategory: 'Academic',
      reasonDetails: '',
      signatureMethod: 'digital',
      internSignature: user.savedSignature ?? '',
      wetCopyImage: '',
      groupMode: false,
      groupMembers: [],
    };
  }
  return {
    memberType: req.memberType,
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

const EDITABLE: readonly RequestStatus[] = ['draft', 'returned', 'submitted'];

/** Only the person who filed a request may edit it, and only before HR decides. */
export function canEdit(req: AbsenceRequest | null | undefined, user: User | null | undefined): boolean {
  return Boolean(req && user && req.uid === user.uid && EDITABLE.includes(req.status));
}

/** Why the request can't be submitted yet, or null when it can. */
export function submitProblem(db: Db, draft: AbsenceRequest, input: DraftInput, editingId: string | null, now: Date): string | null {
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
  if (conflict) return `Duplicate blocked: ${conflictMessage(conflict, draft.uid)}`;
  return null;
}

export interface SaveOptions {
  readonly now: Date;
  /** The new request's id, when it isn't an edit. */
  readonly newId: string;
  /** "Save this signature to my profile" ticked. */
  readonly saveSignatureToProfile: boolean;
}

export function saveRequest(
  db: Db,
  user: User,
  input: DraftInput,
  target: 'draft' | 'submitted',
  editingId: string | null,
  opts: SaveOptions,
): Outcome<{ id: string }> {
  const existing = editingId ? db.requests[editingId] ?? null : null;
  if (editingId && !canEdit(existing, user)) {
    return { ok: false, error: 'This request was already reviewed by HR and can no longer be edited.' };
  }
  if (existing?.status === 'submitted' && target === 'draft') {
    return { ok: false, error: "A request waiting for HR can't go back to draft. Save your changes, or withdraw it instead." };
  }
  if (input.groupMode && input.groupMembers.some((m) => !m.name.trim())) {
    return { ok: false, error: 'Enter the name of every person in the group (or remove the empty row).' };
  }

  const draft = buildDraft(input, user, existing, opts.now);
  if (target === 'submitted') {
    const problem = submitProblem(db, draft, input, editingId, opts.now);
    if (problem) return { ok: false, error: problem };
  }

  const nowIso = opts.now.toISOString();
  const id = existing?.id ?? opts.newId;
  const remarks =
    target === 'draft'
      ? 'Saved as draft.'
      : existing?.status === 'returned'
        ? 'Revised and resubmitted letter.'
        : existing?.status === 'submitted'
          ? 'Edited while waiting for HR review.'
          : 'Submitted official absence request.';
  const entry: HistoryEntry = { status: target, byUid: user.uid, byName: user.name, remarks, at: nowIso };

  const saved: AbsenceRequest = {
    ...draft,
    id,
    status: target,
    review: existing?.review ?? null,
    // Paper copy tracking for hand-signed letters handed in to HR. Any edit means a new paper.
    paperCopy: draft.signatureMethod === 'wet-paper' ? { status: 'awaiting', receivedAt: null, receivedByName: null } : null,
    history: [...(existing?.history ?? []), entry],
    createdAt: existing?.createdAt ?? nowIso,
    submittedAt: target === 'submitted' ? nowIso : existing?.submittedAt ?? null,
    updatedAt: nowIso,
    templateVersion: db.settings.letter.templateVersion,
  };

  const users =
    opts.saveSignatureToProfile && draft.signatureMethod === 'digital' && draft.internSignature
      ? [{ ...user, savedSignature: draft.internSignature }]
      : [];

  const message =
    target === 'draft'
      ? 'Draft saved.'
      : existing?.status === 'submitted'
        ? 'Changes saved. HR will see the updated letter.'
        : 'Request signed and submitted to HR.';

  return {
    ok: true,
    value: { id },
    message,
    changes: {
      requests: [saved],
      users,
      deleteSlots: existing ? slotKeysOfRequest(db, id) : [],
      putSlots: target === 'submitted' ? slotsFor(saved) : {},
    },
  };
}

export function withdrawRequest(db: Db, user: User, id: string, now: Date): Outcome {
  const req = db.requests[id];
  if (!req || req.status !== 'submitted' || req.uid !== user.uid) return { ok: false, error: 'Only a pending request you filed can be withdrawn.' };
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
          history: [...req.history, { status: 'withdrawn', byUid: user.uid, byName: user.name, remarks: 'Withdrawn before HR review.', at }],
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
  if (decision === 'approved' && isAwaitingPaperCopy(req)) return { ok: false, error: 'Mark the hand-signed paper copy as received before approving.' };
  const remarks = remarksIn.trim();
  if (decision !== 'approved' && !remarks) return { ok: false, error: `Remarks are required when a request is ${decision}.` };

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
      requests: [{ ...req, status: decision, review, updatedAt: at, history: [...req.history, { status: decision, byUid: hr.uid, byName: hr.name, remarks, at }] }],
      // Returned or declined frees the dates, so the person can file again or revise.
      deleteSlots: slotKeysOfRequest(db, id),
    },
  };
}

// ---- ids ------------------------------------------------------------------------

export function newRequestId(now: Date): string {
  return `req-${currentYear(now)}-${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
