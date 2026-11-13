import type {
  AbsenceRequest,
  Changes,
  Counter,
  Db,
  FormatWording,
  GroupMember,
  LetterSettings,
  MemberType,
  Settings,
  Slot,
  User,
} from './types';
import { LETTER_FORMAT_VERSION } from './types';

/** The two formats as HR's 2026 "Notice of Absence" letters word them. */
export const DEFAULT_FORMATS: Readonly<Record<MemberType, FormatWording>> = {
  intern: {
    salutation: 'Good day,',
    apologyParagraph:
      'I kindly ask for your understanding and I apologize for any inconvenience my absence may cause. I will make sure to complete or properly coordinate my pending tasks before leaving.',
    apologyParagraphGroup:
      'We kindly ask for your understanding and we apologize for any inconvenience our absence may cause. We will make sure to complete or properly coordinate our pending tasks before leaving.',
    thankYouParagraph: 'Thank you for your kind consideration.',
    thankYouParagraphGroup: 'Thank you for your kind consideration.',
    closing: 'Respectfully,',
    notedBy: [{ name: 'Ms. Jean Ashley S. Chico', title: 'HR Officer' }],
  },
  employee: {
    salutation: 'Dear Ma’am Jean:',
    apologyParagraph:
      'I kindly ask for your understanding regarding my unavailability on the said date. I apologize for any inconvenience my absence may cause. I will make sure to complete or properly coordinate my pending tasks before leaving.',
    apologyParagraphGroup:
      'We kindly ask for your understanding regarding our unavailability on the said date. We apologize for any inconvenience our absence may cause. We will make sure to complete or properly coordinate our pending tasks before leaving.',
    thankYouParagraph: 'Thank you for your kind understanding and consideration.',
    thankYouParagraphGroup: 'Thank you for your kind understanding and consideration.',
    closing: 'Very respectfully yours,',
    notedBy: [
      { name: 'Mr. Mark Anthony Santos', title: 'CEO' },
      { name: 'Ms. Jean Ashley S. Chico', title: 'HR Officer' },
      { name: 'Ms. Ma. Beatriz B. Conos', title: 'HR / Marketing Officer' },
    ],
  },
};

export const DEFAULT_LETTER_TEXT = {
  signatoryName: 'Ms. Jean Ashley S. Chico',
  signatoryTitle: 'HR Officer',
  companyName: 'Alpha Premier Group of Companies',
  subject: 'Notice of Absence',
} as const;

/** A new Db with the changes written: what SQLite will hold once the same changes are committed. */
export function applyChanges(db: Db, changes: Changes): Db {
  const users = { ...db.users };
  for (const u of changes.users ?? []) users[u.uid] = u;
  const requests = { ...db.requests };
  for (const r of changes.requests ?? []) requests[r.id] = r;
  const absenceSlots = { ...db.absenceSlots };
  for (const key of changes.deleteSlots ?? []) delete absenceSlots[key];
  Object.assign(absenceSlots, changes.putSlots ?? {});
  const counters = { ...db.counters, ...(changes.counters ?? {}) };
  return { users, requests, absenceSlots, counters, settings: changes.settings ?? db.settings };
}

type Loose = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

function normalizeMember(m: Loose): GroupMember {
  return {
    uid: strOrNull(m.uid),
    name: str(m.name),
    internId: str(m.internId),
    position: str(m.position),
    department: str(m.department),
    memberType: m.memberType === 'employee' ? 'employee' : 'intern',
    signature: str(m.signature),
  };
}

/** Fills in what older saved data (or seed.json) leaves out, so the rest of the app can rely on every field. */
export function normalizeRequest(raw: Loose): AbsenceRequest {
  const snapshot = (raw.snapshot ?? {}) as Loose;
  const groupMembers = Array.isArray(raw.groupMembers) ? (raw.groupMembers as Loose[]).map(normalizeMember) : [];
  const uid = str(raw.uid);
  const memberUids = Array.isArray(raw.memberUids)
    ? (raw.memberUids as unknown[]).filter((x): x is string => typeof x === 'string')
    : [uid, ...groupMembers.map((m) => m.uid).filter((x): x is string => Boolean(x))];
  const method = raw.signatureMethod;
  return {
    id: str(raw.id),
    refNo: strOrNull(raw.refNo),
    uid,
    memberType: raw.memberType === 'employee' ? 'employee' : 'intern',
    snapshot: {
      name: str(snapshot.name),
      internId: str(snapshot.internId),
      position: str(snapshot.position),
      department: str(snapshot.department),
    },
    type: raw.type === 'half' || raw.type === 'multi' ? raw.type : 'full',
    date: strOrNull(raw.date),
    startDate: strOrNull(raw.startDate),
    endDate: strOrNull(raw.endDate),
    days: typeof raw.days === 'number' ? raw.days : 1,
    shift: raw.shift === 'morning' || raw.shift === 'afternoon' ? raw.shift : null,
    timeRange: strOrNull(raw.timeRange),
    hoursImpact: typeof raw.hoursImpact === 'number' ? raw.hoursImpact : 8,
    reasonCategory: str(raw.reasonCategory, 'Other'),
    reasonDetails: str(raw.reasonDetails),
    signatureMethod: method === 'wet-upload' || method === 'wet-paper' ? method : 'digital',
    internSignature: str(raw.internSignature),
    wetCopyImage: str(raw.wetCopyImage),
    isGroup: Boolean(raw.isGroup) && groupMembers.length > 0,
    groupMembers,
    memberUids: [...new Set(memberUids)],
    status: (['draft', 'submitted', 'approved', 'returned', 'declined', 'withdrawn'] as const).find((s) => s === raw.status) ?? 'draft',
    review: (raw.review as AbsenceRequest['review']) ?? null,
    paperCopy: (raw.paperCopy as AbsenceRequest['paperCopy']) ?? null,
    history: Array.isArray(raw.history) ? (raw.history as AbsenceRequest['history']) : [],
    createdAt: str(raw.createdAt, new Date().toISOString()),
    submittedAt: strOrNull(raw.submittedAt),
    updatedAt: str(raw.updatedAt, str(raw.createdAt, new Date().toISOString())),
    templateVersion: str(raw.templateVersion, '1.0'),
  };
}

export function normalizeUser(raw: Loose): User {
  const role = raw.role === 'hr' || raw.role === 'employee' ? raw.role : 'intern';
  return {
    uid: str(raw.uid),
    name: str(raw.name),
    email: str(raw.email),
    internId: str(raw.internId),
    position: str(raw.position),
    department: str(raw.department),
    role,
    memberType: role === 'employee' ? 'employee' : role === 'intern' ? 'intern' : undefined,
    status: raw.status === 'pending' || raw.status === 'disabled' ? raw.status : 'active',
    savedSignature: str(raw.savedSignature),
    passwordHash: typeof raw.passwordHash === 'string' ? raw.passwordHash : undefined,
    createdAt: str(raw.createdAt, new Date().toISOString()),
  };
}

function normalizeFormat(raw: unknown, d: FormatWording): FormatWording {
  const f = (raw ?? {}) as Loose;
  const notedBy = Array.isArray(f.notedBy)
    ? (f.notedBy as Loose[]).map((n) => ({ name: str(n?.name).trim(), title: str(n?.title).trim() })).filter((n) => n.name)
    : [];
  return {
    salutation: str(f.salutation) || d.salutation,
    apologyParagraph: str(f.apologyParagraph) || d.apologyParagraph,
    apologyParagraphGroup: str(f.apologyParagraphGroup) || d.apologyParagraphGroup,
    thankYouParagraph: str(f.thankYouParagraph) || d.thankYouParagraph,
    thankYouParagraphGroup: str(f.thankYouParagraphGroup) || d.thankYouParagraphGroup,
    closing: str(f.closing) || d.closing,
    notedBy: notedBy.length > 0 ? notedBy : d.notedBy,
  };
}

/**
 * Settings saved before the 2026 letter format (no formatVersion) had one
 * wording for everyone; they move to the new formats' wording, keeping HR's
 * approval signature and the attachments switch.
 */
export function normalizeSettings(raw: unknown): Settings {
  const letter = ((raw as Loose | null)?.letter ?? {}) as Loose;
  const current = letter.formatVersion === LETTER_FORMAT_VERSION;
  const formats = (current ? letter.formats : null) as Loose | null;
  const l: LetterSettings = {
    formatVersion: LETTER_FORMAT_VERSION,
    signatoryName: (current && str(letter.signatoryName)) || DEFAULT_LETTER_TEXT.signatoryName,
    signatoryTitle: (current && str(letter.signatoryTitle)) || DEFAULT_LETTER_TEXT.signatoryTitle,
    companyName: (current && str(letter.companyName)) || DEFAULT_LETTER_TEXT.companyName,
    subject: (current && str(letter.subject)) || DEFAULT_LETTER_TEXT.subject,
    formats: {
      intern: normalizeFormat(formats?.intern, DEFAULT_FORMATS.intern),
      employee: normalizeFormat(formats?.employee, DEFAULT_FORMATS.employee),
    },
    hrSignature: str(letter.hrSignature),
    templateVersion: current ? str(letter.templateVersion, '2.0') : '2.0',
    attachmentsEnabled: Boolean(letter.attachmentsEnabled),
  };
  return { letter: l };
}

/** Builds a clean Db from anything shaped like seed.json or the old app's saved state. */
export function normalizeDb(raw: unknown): Db {
  const r = (raw ?? {}) as Loose;
  const users: Record<string, User> = {};
  for (const [key, value] of Object.entries((r.users ?? {}) as Record<string, Loose>)) {
    // The old app kept alias entries ("demo-intern") pointing at another uid: keep one per uid.
    const u = normalizeUser(value);
    if (u.uid && (key === u.uid || !users[u.uid])) users[u.uid] = u;
  }
  const requests: Record<string, AbsenceRequest> = {};
  for (const value of Object.values((r.requests ?? {}) as Record<string, Loose>)) {
    const req = normalizeRequest(value);
    if (req.id) requests[req.id] = req;
  }
  const absenceSlots: Record<string, Slot> = {};
  for (const [key, value] of Object.entries((r.absenceSlots ?? {}) as Record<string, Loose>)) {
    absenceSlots[key] = { requestId: str(value.requestId), uid: str(value.uid) };
  }
  const counters: Record<string, Counter> = {};
  for (const [year, value] of Object.entries((r.counters ?? {}) as Record<string, Loose>)) {
    counters[year] = { nextRefNo: typeof value.nextRefNo === 'number' ? value.nextRefNo : 1 };
  }
  return { users, requests, absenceSlots, counters, settings: normalizeSettings(r.settings) };
}

/** Every document in the Db as one set of changes: how a reset writes the seed into SQLite. */
export function changesForWholeDb(db: Db): Changes {
  return {
    users: Object.values(db.users),
    requests: Object.values(db.requests),
    putSlots: db.absenceSlots,
    settings: db.settings,
    counters: db.counters,
  };
}
