/**
 * The local stand-in for `npm run dev`: no Firebase. The server's handlers run
 * in the page on the sample data, which is kept in this browser's
 * localStorage, and HR signs in with the made-up accounts in src/config.ts.
 * Everything the screens can do here, they do the same way on Firebase.
 */

import { LOCAL_HR_ACCOUNTS } from '@/config';
import { normalizeDb } from '@/core/db';
import { seedDb } from '@/core/seed';
import type { Db, User } from '@/core/types';
import { hrCall, publicCall } from '@/server/handlers';
import { MemoryStore } from '@/server/memory-store';
import type { Platform } from '@/platform';
import type { Backend, HrAccount } from './types';

export const LOCAL_DB_KEY = 'apg-excuse-letters/local-db';
const SESSION_KEY = 'apg-excuse-letters/local-session';
const NAMES_KEY = 'apg-excuse-letters/local-names';

type Local = Pick<Platform, 'readLocal' | 'writeLocal'>;

function readJson<T>(local: Local, key: string): T | null {
  const raw = local.readLocal(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function createLocalBackend(local: Local): Backend {
  const saved = readJson<unknown>(local, LOCAL_DB_KEY);
  const save = (db: Db) => local.writeLocal(LOCAL_DB_KEY, JSON.stringify(db));
  let store = new MemoryStore(saved ? normalizeDb(saved) : seedDb(), save);
  const listeners = new Set<(account: HrAccount | null) => void>();

  const names = (): Record<string, string> => readJson<Record<string, string>>(local, NAMES_KEY) ?? {};
  const accountOf = (uid: string | null): HrAccount | null => {
    const a = LOCAL_HR_ACCOUNTS.find((x) => x.uid === uid);
    return a ? { uid: a.uid, email: a.email, name: names()[a.uid] ?? a.name } : null;
  };
  const current = () => accountOf(local.readLocal(SESSION_KEY));
  const tell = () => {
    const account = current();
    for (const l of listeners) l(account);
  };
  const userOf = (a: HrAccount): User => ({ uid: a.uid, email: a.email, name: a.name || a.email, role: 'hr' });

  return {
    kind: 'local',
    label: 'this browser (sample data, no Firebase)',
    publicCall: (call) => publicCall(store, call, new Date()) as never,
    async hrCall(call) {
      const account = current();
      if (!account) return { ok: false, error: 'Your sign-in has run out. Sign out and sign in again.' };
      return hrCall(store, userOf(account), call, new Date()) as never;
    },
    watch(changed) {
      listeners.add(changed);
      queueMicrotask(() => changed(current()));
      return () => listeners.delete(changed);
    },
    async signIn(email, password) {
      const a = LOCAL_HR_ACCOUNTS.find((x) => x.email === email.trim().toLowerCase());
      if (!a || a.password !== password) throw new Error('Wrong email or password.');
      local.writeLocal(SESSION_KEY, a.uid);
      tell();
      return accountOf(a.uid) as HrAccount;
    },
    async signOut() {
      local.writeLocal(SESSION_KEY, null);
      tell();
    },
    async setName(name) {
      const account = current();
      if (!account) throw new Error('Sign in first.');
      local.writeLocal(NAMES_KEY, JSON.stringify({ ...names(), [account.uid]: name.trim() }));
      return accountOf(account.uid) as HrAccount;
    },
    sample: {
      accounts: LOCAL_HR_ACCOUNTS,
      async reset() {
        local.writeLocal(NAMES_KEY, null);
        const db = seedDb();
        save(db);
        store = new MemoryStore(db, save);
      },
    },
  };
}
