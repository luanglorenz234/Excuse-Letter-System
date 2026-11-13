/**
 * The data model, the same shape the old web app and seed.json use, so data
 * can move between them (and later into Firestore) unchanged.
 */

/**
 * Employees sign in to file; HR signs in as admin. Interns have no account:
 * they file through the intern form and come back with their letter's code.
 * 'intern' accounts can still be in older data, but can no longer sign in.
 */
export type Role = 'intern' | 'employee' | 'hr';
export type MemberType = 'intern' | 'employee';
/** 'pending' is only in older data: accounts are active as soon as they register. */
export type UserStatus = 'active' | 'pending' | 'disabled';

export interface User {
  readonly uid: string;
  readonly name: string;
  readonly email: string;
  readonly internId: string;
  readonly position: string;
  readonly department: string;
  readonly role: Role;
  readonly memberType?: MemberType | undefined;
  readonly status: UserStatus;
  readonly savedSignature?: string | undefined;
  /** Accounts made through the register form only. Never sent anywhere. */
  readonly passwordHash?: string | undefined;
  readonly createdAt: string;
}

export type RequestStatus = 'draft' | 'submitted' | 'approved' | 'returned' | 'declined' | 'withdrawn';
export type AbsenceType = 'full' | 'half' | 'multi';
export type Shift = 'morning' | 'afternoon';
/** digital: drawn or uploaded image. wet-upload: photo of the hand-signed letter. wet-paper: paper handed to HR. */
export type SignatureMethod = 'digital' | 'wet-upload' | 'wet-paper';

export interface Snapshot {
  readonly name: string;
  readonly internId: string;
  readonly position: string;
  readonly department: string;
}

/** Someone else on a group letter. The person filing is not in this list. */
export interface GroupMember {
  /** Null for someone typed in who has no account. */
  readonly uid: string | null;
  readonly name: string;
  readonly internId: string;
  readonly position: string;
  readonly department: string;
  readonly memberType: MemberType;
  readonly signature: string;
}

export interface Review {
  readonly byUid: string;
  readonly byName: string;
  readonly remarks: string;
  readonly at: string;
  readonly hrSignature?: string | null | undefined;
}

export interface HistoryEntry {
  readonly status: RequestStatus;
  readonly byUid: string;
  readonly byName: string;
  readonly remarks: string;
  readonly at: string;
}

export interface PaperCopy {
  readonly status: 'awaiting' | 'received';
  readonly receivedAt: string | null;
  readonly receivedByName: string | null;
}

/** The parts of the letter a comment can be on: each is one paragraph or block of the A4 letter. */
export const LETTER_BLOCKS = ['date', 'addressee', 'subject', 'salutation', 'opening', 'apology', 'thanks', 'closing', 'signers', 'noted'] as const;
export type LetterBlock = (typeof LETTER_BLOCKS)[number];

/**
 * HR's comment on a stretch of the letter, like a Google Docs comment: the
 * words are highlighted and the comment sits beside them. HR writes them while
 * reviewing; the member sees them once the letter is returned.
 */
export interface LetterComment {
  readonly id: string;
  readonly block: LetterBlock;
  /** The highlighted words, and where they started in that block's text when HR commented. */
  readonly quote: string;
  readonly start: number;
  readonly body: string;
  readonly byUid: string;
  readonly byName: string;
  readonly at: string;
  /** When the member was shown it (the letter went back with it). Null: still HR's draft. */
  readonly sentAt: string | null;
  readonly resolvedAt: string | null;
  readonly resolvedByName: string | null;
}

export const COMMENT_MAX = 600;

export interface AbsenceRequest {
  readonly id: string;
  readonly refNo: string | null;
  /** The account that filed it, or '' for an intern's letter (interns have no account). */
  readonly uid: string;
  /** An intern's letter: the code they open it with again. Null for a letter filed from an account. */
  readonly accessCode: string | null;
  readonly memberType: MemberType;
  readonly snapshot: Snapshot;
  readonly type: AbsenceType;
  readonly date: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly days: number;
  readonly shift: Shift | null;
  readonly timeRange: string | null;
  readonly hoursImpact: number;
  readonly reasonCategory: string;
  readonly reasonDetails: string;
  readonly signatureMethod: SignatureMethod;
  readonly internSignature: string;
  readonly wetCopyImage: string;
  readonly isGroup: boolean;
  readonly groupMembers: readonly GroupMember[];
  /** Everyone on the letter who has an account. */
  readonly memberUids: readonly string[];
  readonly status: RequestStatus;
  readonly review: Review | null;
  readonly paperCopy: PaperCopy | null;
  readonly history: readonly HistoryEntry[];
  /** HR's comments on the letter, oldest first. */
  readonly comments: readonly LetterComment[];
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly updatedAt: string;
  readonly templateVersion: string;
}

/** Someone listed under "Noted by:". */
export interface NotedBy {
  readonly name: string;
  readonly title: string;
}

/** The fixed wording of one letter format (src/core/db.ts DEFAULT_FORMATS). Interns and employees each have their own. */
export interface FormatWording {
  /** "Good day," for interns, "Dear Ma'am Jean:" for employees. */
  readonly salutation: string;
  readonly apologyParagraph: string;
  readonly apologyParagraphGroup: string;
  readonly thankYouParagraph: string;
  readonly thankYouParagraphGroup: string;
  /** "Respectfully," or "Very respectfully yours," */
  readonly closing: string;
}

/**
 * The letter format the app draws. 2: the 2026 "Notice of Absence" letterhead,
 * wording editable. 3: the same letter, wording fixed; HR edits only who is
 * listed under "Noted by".
 */
export const LETTER_FORMAT_VERSION = 3;

export interface LetterSettings {
  readonly formatVersion: number;
  /** The HR officer the letter is addressed to, who signs it on approval. */
  readonly signatoryName: string;
  readonly signatoryTitle: string;
  readonly companyName: string;
  readonly subject: string;
  /** Who is listed under "Noted by:" on each format, in order. The one named like the HR officer gets the approval signature; the rest sign the printed copy. */
  readonly notedBy: Readonly<Record<MemberType, readonly NotedBy[]>>;
  readonly hrSignature: string;
  readonly templateVersion: string;
  readonly attachmentsEnabled: boolean;
}

export interface Settings {
  readonly letter: LetterSettings;
}

/** One half-day taken by one person: key `{uid}_{yyyy-mm-dd}_{am|pm}`. */
export interface Slot {
  readonly requestId: string;
  readonly uid: string;
}

export interface Counter {
  readonly nextRefNo: number;
}

/** Everything the app keeps. Lives in SQLite in the desktop app. */
export interface Db {
  readonly users: Readonly<Record<string, User>>;
  readonly requests: Readonly<Record<string, AbsenceRequest>>;
  readonly absenceSlots: Readonly<Record<string, Slot>>;
  readonly settings: Settings;
  readonly counters: Readonly<Record<string, Counter>>;
}

/**
 * One save: the documents written and the slots removed. Applied in a single
 * SQLite transaction by Rust (src-tauri/src/db.rs), like a Firestore batch.
 */
export interface Changes {
  readonly users?: readonly User[];
  readonly requests?: readonly AbsenceRequest[];
  readonly putSlots?: Readonly<Record<string, Slot>>;
  readonly deleteSlots?: readonly string[];
  readonly settings?: Settings;
  readonly counters?: Readonly<Record<string, Counter>>;
}

/** What an action returns: the changes to save and what to tell the person, or why it was refused. */
export type Outcome<T = undefined> =
  | { readonly ok: true; readonly changes: Changes; readonly message: string; readonly value: T }
  | { readonly ok: false; readonly error: string };

export const MAX_GROUP_SIZE = 6;
export const REASON_MIN = 30;
export const REASON_MAX = 400;
export const REASON_CATEGORIES = ['Academic', 'Medical', 'Family emergency', 'School activity', 'Personal', 'Other'] as const;

export function isHr(user: User | null | undefined): boolean {
  return user?.role === 'hr';
}

/** As shown under a name: "Intern", "Employee", "HR". Used by the sidebar. */
export function roleWord(role: string): string {
  if (role === 'hr') return 'HR';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Two letters for an avatar: "Juan Dela Cruz" → "JC". Titles like "Ms." are skipped. */
export function initials(name: string): string {
  const clean = name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AP';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}
