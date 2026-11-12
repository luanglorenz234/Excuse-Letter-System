/**
 * Signing in, registering, HR's edits to people and to the letter settings.
 */

import { TEMP_ACCOUNTS, type TempAccount } from '@/config';
import { DEFAULT_GROUP_APOLOGY, DEFAULT_GROUP_THANKS } from './db';
import type { Db, LetterSettings, MemberType, Outcome, Role, User, UserStatus } from './types';

export type SignInMode = 'member' | 'admin';

export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return `sha256:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const MEMBER_ALIASES = ['demo', 'intern', 'demo@intern.com', 'intern@demo.com'];
const ADMIN_ALIASES = ['admin', 'hr', 'demo@admin.com', 'admin@demo.com'];

/** The account an email means: a test account, an alias for one ("admin", "intern"), or a registered person. */
export function findAccount(db: Db, emailIn: string, mode: SignInMode, temp: readonly TempAccount[] = TEMP_ACCOUNTS): { user: User | null; temp: TempAccount | null } {
  let email = emailIn.trim().toLowerCase();
  const aliasRole = mode === 'member' && MEMBER_ALIASES.includes(email) ? 'intern' : mode === 'admin' && ADMIN_ALIASES.includes(email) ? 'hr' : null;
  const alias = aliasRole ? temp.find((a) => a.role === aliasRole) : undefined;
  if (alias) email = alias.email.toLowerCase();
  const t = temp.find((a) => a.email.toLowerCase() === email) ?? null;
  const user = t ? db.users[t.uid] ?? null : Object.values(db.users).find((u) => u.email.toLowerCase() === email) ?? null;
  return { user, temp: t };
}

/** The signed-in person, or why not. Same message for an unknown email and a wrong password. */
export async function signIn(db: Db, email: string, password: string, mode: SignInMode, temp: readonly TempAccount[] = TEMP_ACCOUNTS): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const found = findAccount(db, email, mode, temp);
  const user = found.user;
  const passwordOk = user
    ? found.temp
      ? password === found.temp.password
      : Boolean(user.passwordHash) && (await hashPassword(password)) === user.passwordHash
    : false;
  if (!user || !passwordOk) return { ok: false, error: 'Incorrect email or password.' };
  if (mode === 'admin' && user.role !== 'hr') return { ok: false, error: 'This account is not an admin. Use "Answer Absence Form" instead.' };
  if (mode === 'member' && user.role === 'hr') return { ok: false, error: 'Admin accounts sign in through "Login as Admin".' };
  if (user.status === 'disabled') return { ok: false, error: 'This account has been disabled. Please contact HR.' };
  return { ok: true, user };
}

export interface Registration {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly memberType: MemberType;
}

/** A new intern or employee account, active at once with a starting ID and position HR can change. */
export async function register(db: Db, reg: Registration, now: Date, temp: readonly TempAccount[] = TEMP_ACCOUNTS): Promise<Outcome<{ user: User }>> {
  const name = reg.name.trim();
  const email = reg.email.trim();
  if (!name || !email) return { ok: false, error: 'Enter your name and email.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (reg.password.length < 8) return { ok: false, error: 'The password must be at least 8 characters.' };
  const lower = email.toLowerCase();
  if (Object.values(db.users).some((u) => u.email.toLowerCase() === lower) || temp.some((a) => a.email.toLowerCase() === lower)) {
    return { ok: false, error: 'An account with that email already exists. Please sign in instead.' };
  }
  const employee = reg.memberType === 'employee';
  const seq = String(Math.floor(Math.random() * 80 + 10));
  const user: User = {
    uid: `${reg.memberType}-${now.getTime()}`,
    name,
    email,
    internId: employee ? `APG-EMP-${now.getFullYear()}-0${seq}` : `APG-INT-${now.getFullYear()}-0${seq}`,
    position: employee ? 'Operations Associate' : 'IT Associate Intern',
    department: employee ? 'Operations' : 'Information Technology',
    role: reg.memberType,
    memberType: reg.memberType,
    status: 'active',
    savedSignature: '',
    passwordHash: await hashPassword(reg.password),
    createdAt: now.toISOString(),
  };
  return { ok: true, value: { user }, message: `Welcome, ${name}! Your account is active.`, changes: { users: [user] } };
}

export interface MemberEdit {
  readonly role: Exclude<Role, 'hr'>;
  readonly internId: string;
  readonly position: string;
  readonly department: string;
  readonly status: UserStatus;
}

export function updateMember(db: Db, hr: User, uid: string, edit: MemberEdit): Outcome {
  const u = db.users[uid];
  if (!u || hr.role !== 'hr' || u.role === 'hr') return { ok: false, error: 'Only HR can change members.' };
  const internId = edit.internId.trim();
  const position = edit.position.trim();
  const department = edit.department.trim();
  if (edit.status === 'active' && (!internId || !position || !department)) {
    return { ok: false, error: 'Assign an ID number, official position and department to activate this member.' };
  }
  const updated: User = { ...u, role: edit.role, memberType: edit.role, internId, position, department, status: edit.status };
  return { ok: true, value: undefined, message: `Updated ${u.name} (${edit.status}).`, changes: { users: [updated] } };
}

/** Saves HR's letter wording; each save is a new template version (1.0 → 1.1). */
export function saveLetterSettings(db: Db, hr: User, next: Omit<LetterSettings, 'templateVersion' | 'companyName'>): Outcome<{ version: string }> {
  if (hr.role !== 'hr') return { ok: false, error: 'Only HR can change the letter.' };
  const required: (keyof typeof next)[] = ['signatoryName', 'signatoryTitle', 'subject', 'salutation', 'addressBlock', 'apologyParagraph', 'thankYouParagraph'];
  if (required.some((k) => !String(next[k]).trim())) return { ok: false, error: 'Fill in every field of the letter.' };
  const [major, minor] = db.settings.letter.templateVersion.split('.');
  const version = `${major ?? '1'}.${Number(minor ?? 0) + 1}`;
  const letter: LetterSettings = {
    ...db.settings.letter,
    ...next,
    signatoryName: next.signatoryName.trim(),
    signatoryTitle: next.signatoryTitle.trim(),
    subject: next.subject.trim(),
    salutation: next.salutation.trim(),
    apologyParagraph: next.apologyParagraph.trim(),
    thankYouParagraph: next.thankYouParagraph.trim(),
    apologyParagraphGroup: next.apologyParagraphGroup.trim() || DEFAULT_GROUP_APOLOGY,
    thankYouParagraphGroup: next.thankYouParagraphGroup.trim() || DEFAULT_GROUP_THANKS,
    templateVersion: version,
  };
  return { ok: true, value: { version }, message: `Letter settings saved (template v${version}).`, changes: { settings: { letter } } };
}
