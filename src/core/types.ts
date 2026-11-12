/**
 * The data model, the same shape the old web app and seed.json use, so data
 * can move between them (and later into Firestore) unchanged.
 */

export type Role = 'intern' | 'employee' | 'hr';
export type MemberType = 'intern' | 'employee';
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

export interface AbsenceRequest {
  readonly id: string;
  readonly refNo: string | null;
  /** The person who filed it. */
  readonly uid: string;
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
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly updatedAt: string;
  readonly templateVersion: string;
}

export interface LetterSettings {
  readonly signatoryName: string;
  readonly signatoryTitle: string;
  readonly companyName: string;
  readonly subject: string;
  readonly salutation: string;
  readonly addressBlock: string;
  readonly apologyParagraph: string;
  readonly thankYouParagraph: string;
  readonly apologyParagraphGroup: string;
  readonly thankYouParagraphGroup: string;
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
