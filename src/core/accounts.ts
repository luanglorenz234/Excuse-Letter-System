/**
 * Signing in, registering, and HR's letter settings.
 *
 * Only employees and HR have accounts. Interns file through the intern form
 * without one (src/core/requests.ts, filer null).
 */

import { TEMP_ACCOUNTS, type TempAccount } from '@/config';
import { LETTER_FORMAT_VERSION, type Db, type LetterSettings, type MemberType, type NotedBy, type Outcome, type User } from './types';

export type SignInMode = 'member' | 'admin';

export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return `sha256:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const MEMBER_ALIASES = ['demo', 'employee', 'demo@employee.com', 'employee@demo.com'];
const ADMIN_ALIASES = ['admin', 'hr', 'demo@admin.com', 'admin@demo.com'];

/** The account an email means: a test account, an alias for one ("admin", "employee"), or a registered person. */
export function findAccount(db: Db, emailIn: string, mode: SignInMode, temp: readonly TempAccount[] = TEMP_ACCOUNTS): { user: User | null; temp: TempAccount | null } {
  let email = emailIn.trim().toLowerCase();
  const aliasRole = mode === 'member' && MEMBER_ALIASES.includes(email) ? 'employee' : mode === 'admin' && ADMIN_ALIASES.includes(email) ? 'hr' : null;
  const alias = aliasRole ? temp.find((a) => a.role === aliasRole) : undefined;
  if (alias) email = alias.email.toLowerCase();
  const t = temp.find((a) => a.email.toLowerCase() === email) ?? null;
  const user = t ? db.users[t.uid] ?? null : Object.values(db.users).find((u) => u.email.toLowerCase() === email) ?? null;
  return { user, temp: t };
}

export const INTERN_NO_ACCOUNT = "Interns don't sign in. Use the intern absence form on the home screen instead.";

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
  if (mode === 'admin' && user.role !== 'hr') return { ok: false, error: 'This account is not an admin. Use "Employee sign-in" instead.' };
  if (mode === 'member' && user.role === 'hr') return { ok: false, error: 'Admin accounts sign in through "Login as admin".' };
  if (mode === 'member' && user.role === 'intern') return { ok: false, error: INTERN_NO_ACCOUNT };
  if (user.status === 'disabled') return { ok: false, error: 'This account has been disabled. Please contact HR.' };
  return { ok: true, user };
}

export interface Registration {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/**
 * A new employee account, active at once. Position and department aren't
 * part of the account: the employee types them on each letter.
 */
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
  const user: User = {
    uid: `employee-${now.getTime()}`,
    name,
    email,
    internId: '',
    position: '',
    department: '',
    role: 'employee',
    memberType: 'employee',
    status: 'active',
    savedSignature: '',
    passwordHash: await hashPassword(reg.password),
    createdAt: now.toISOString(),
  };
  return { ok: true, value: { user }, message: `Welcome, ${name}! Your account is active.`, changes: { users: [user] } };
}

/** What HR edits in Settings → Letter. The wording itself is fixed (DEFAULT_FORMATS). */
export type LetterSettingsInput = Omit<LetterSettings, 'templateVersion' | 'formatVersion'>;

const cleanNotedBy = (list: readonly NotedBy[]): NotedBy[] => list.map((n) => ({ name: n.name.trim(), title: n.title.trim() })).filter((n) => n.name);

/** Saves HR's letter settings; each save is a new template version (3.0 → 3.1). */
export function saveLetterSettings(db: Db, hr: User, next: LetterSettingsInput): Outcome<{ version: string }> {
  if (hr.role !== 'hr') return { ok: false, error: 'Only HR can change the letter.' };
  const general = [next.signatoryName, next.signatoryTitle, next.companyName, next.subject];
  if (general.some((v) => !v.trim())) return { ok: false, error: 'Fill in the HR officer, title, company and subject.' };
  const notedBy: Record<MemberType, NotedBy[]> = { intern: cleanNotedBy(next.notedBy.intern), employee: cleanNotedBy(next.notedBy.employee) };
  for (const type of ['intern', 'employee'] as const) {
    if (notedBy[type].length === 0) return { ok: false, error: `List at least one person under "Noted by" on the ${type} letter.` };
  }
  const [major, minor] = db.settings.letter.templateVersion.split('.');
  const version = `${major ?? '3'}.${Number(minor ?? 0) + 1}`;
  const letter: LetterSettings = {
    ...db.settings.letter,
    ...next,
    formatVersion: LETTER_FORMAT_VERSION,
    signatoryName: next.signatoryName.trim(),
    signatoryTitle: next.signatoryTitle.trim(),
    companyName: next.companyName.trim(),
    subject: next.subject.trim(),
    notedBy,
    templateVersion: version,
  };
  return { ok: true, value: { version }, message: `Letter settings saved (template v${version}).`, changes: { settings: { letter } } };
}
