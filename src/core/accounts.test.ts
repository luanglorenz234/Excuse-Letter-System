import { describe, expect, it } from 'vitest';
import { INTERN_NO_ACCOUNT, hashPassword, register, signIn } from './accounts';
import { applyChanges } from './db';
import { seedDb } from './seed';
import type { TempAccount } from '@/config';
import type { User } from './types';

const TEMP: readonly TempAccount[] = [
  { uid: 'hr-chico', role: 'hr', email: 'hr@test.com', password: 'hr-pass-1' },
  { uid: 'emp-carlos', role: 'employee', email: 'emp@test.com', password: 'emp-pass-1' },
];
const NOW = new Date(2026, 10, 12, 9, 0, 0);

describe('who signs in', () => {
  it('employees sign in as members, HR as admin, and not the other way round', async () => {
    const db = seedDb();
    expect((await signIn(db, 'emp@test.com', 'emp-pass-1', 'member', TEMP)).ok).toBe(true);
    expect((await signIn(db, 'hr@test.com', 'hr-pass-1', 'admin', TEMP)).ok).toBe(true);
    expect((await signIn(db, 'emp@test.com', 'emp-pass-1', 'admin', TEMP)).ok).toBe(false);
    expect((await signIn(db, 'hr@test.com', 'hr-pass-1', 'member', TEMP)).ok).toBe(false);
    expect((await signIn(db, 'employee', 'emp-pass-1', 'member', TEMP)).ok).toBe(true);
  });

  it('an intern account from older data is sent to the intern form', async () => {
    const intern: User = {
      uid: 'intern-old',
      name: 'Old Intern',
      email: 'old.intern@test.com',
      internId: '',
      position: '',
      department: '',
      role: 'intern',
      memberType: 'intern',
      status: 'active',
      passwordHash: await hashPassword('intern-pass-1'),
      createdAt: NOW.toISOString(),
    };
    const db = applyChanges(seedDb(), { users: [intern] });
    const out = await signIn(db, 'old.intern@test.com', 'intern-pass-1', 'member', TEMP);
    expect(out).toEqual({ ok: false, error: INTERN_NO_ACCOUNT });
  });

  it('registering makes an active employee account', async () => {
    const out = await register(seedDb(), { name: 'Bea Cruz', email: 'bea@test.com', password: 'longenough' }, NOW, TEMP);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.user).toMatchObject({ role: 'employee', memberType: 'employee', status: 'active', position: '', department: '' });
      const db = applyChanges(seedDb(), out.changes);
      expect((await signIn(db, 'bea@test.com', 'longenough', 'member', TEMP)).ok).toBe(true);
    }
  });
});
