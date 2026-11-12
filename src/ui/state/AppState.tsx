import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyChanges, changesForWholeDb } from '@/core/db';
import { seedDb } from '@/core/seed';
import type { Db, Outcome, User } from '@/core/types';
import type { Platform } from '@/platform';
import { ToastRegion, useToasts, type ToastTone } from '../components';

const SESSION_KEY = 'apg-excuse-letters/session';

export interface AppState {
  readonly platform: Platform;
  readonly db: Db;
  /** The signed-in person, or null. */
  readonly user: User | null;
  /** Saves an action's changes and says how it went. True when it was saved. */
  run<T>(outcome: Outcome<T>): Promise<boolean>;
  notify(message: ReactNode, tone?: ToastTone): void;
  signInAs(uid: string): void;
  signOut(): void;
  /** Puts the sample data back, in SQLite and on screen. */
  resetSampleData(): Promise<void>;
}

const Context = createContext<AppState | null>(null);

export function useApp(): AppState {
  const app = useContext(Context);
  if (!app) throw new Error('useApp() needs an <AppStateProvider> above it.');
  return app;
}

/** The signed-in person. Only for screens behind sign-in. */
export function useUser(): User {
  const { user } = useApp();
  if (!user) throw new Error('No one is signed in.');
  return user;
}

type Load = { state: 'loading' } | { state: 'ready'; db: Db } | { state: 'failed'; error: string };

/**
 * Loads the data once (the sample data on the first run), keeps it in memory
 * for the screens, and writes every change through the platform: SQLite in the
 * desktop app. A save that fails leaves the screen as it was and says so.
 */
export function AppStateProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [uid, setUid] = useState<string | null>(() => platform.readLocal(SESSION_KEY));
  const toasts = useToasts();
  const dbRef = useRef<Db | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let db = await platform.loadDb();
      if (!db) {
        db = seedDb();
        await platform.reset(changesForWholeDb(db));
      }
      if (!cancelled) {
        dbRef.current = db;
        setLoad({ state: 'ready', db });
      }
    })().catch((err: unknown) => {
      if (!cancelled) setLoad({ state: 'failed', error: err instanceof Error ? err.message : String(err) });
    });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  const notify = useCallback((message: ReactNode, tone: ToastTone = 'ok') => void toasts.show(message, tone), [toasts]);

  const run = useCallback(
    async <T,>(outcome: Outcome<T>): Promise<boolean> => {
      if (!outcome.ok) {
        notify(outcome.error, 'warn');
        return false;
      }
      const current = dbRef.current;
      if (!current) return false;
      try {
        await platform.commit(outcome.changes);
      } catch (err) {
        notify(`Not saved: ${err instanceof Error ? err.message : String(err)}`, 'danger');
        return false;
      }
      const next = applyChanges(current, outcome.changes);
      dbRef.current = next;
      setLoad({ state: 'ready', db: next });
      if (outcome.message) notify(outcome.message);
      return true;
    },
    [platform, notify],
  );

  const signInAs = useCallback(
    (next: string) => {
      platform.writeLocal(SESSION_KEY, next);
      setUid(next);
    },
    [platform],
  );
  const signOut = useCallback(() => {
    platform.writeLocal(SESSION_KEY, null);
    setUid(null);
  }, [platform]);

  const resetSampleData = useCallback(async () => {
    const db = seedDb();
    try {
      await platform.reset(changesForWholeDb(db));
    } catch (err) {
      notify(`Couldn't reset: ${err instanceof Error ? err.message : String(err)}`, 'danger');
      return;
    }
    dbRef.current = db;
    setLoad({ state: 'ready', db });
    notify('Sample data restored.');
  }, [platform, notify]);

  const value = useMemo<AppState | null>(() => {
    if (load.state !== 'ready') return null;
    const user = uid ? load.db.users[uid] ?? null : null;
    return { platform, db: load.db, user, run, notify, signInAs, signOut, resetSampleData };
  }, [load, uid, platform, run, notify, signInAs, signOut, resetSampleData]);

  if (load.state === 'failed') {
    return (
      <div className="app-message" role="alert">
        <h1>The data couldn't be opened</h1>
        <p>{load.error}</p>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="app-message" aria-busy="true">
        <p>Opening…</p>
      </div>
    );
  }
  return (
    <Context.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </Context.Provider>
  );
}
