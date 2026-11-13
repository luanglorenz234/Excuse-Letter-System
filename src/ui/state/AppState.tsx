import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Backend, HrAccount, HrCall, PublicCall, Reply } from '@/backend';
import { applyChanges, normalizeSettings } from '@/core/db';
import { isHrOfficer, mayEditSettings } from '@/core/settings';
import type { AbsenceRequest, Db, Settings, User } from '@/core/types';
import type { Platform } from '@/platform';
import type { HrData } from '@/server/handlers';
import { Button, ToastRegion, useToasts, type ToastTone } from '../components';

export interface AppState {
  readonly platform: Platform;
  readonly backend: Backend;
  /** Signed in: every letter and HR's settings. Signed out: no letters, and the settings anyone may read. */
  readonly db: Db;
  /** The HR account signed in, or null. */
  readonly user: User | null;
  /** Signed in but the account has no name yet: the app asks for it before anything else. */
  readonly needsName: boolean;
  /** The account is the HR officer named in Settings: it approves and signs letters. */
  readonly isOfficer: boolean;
  /** The officer, or anyone in HR while no officer is named. */
  readonly mayEditSettings: boolean;

  /** An HR action, on the server; its changes then show on screen. True when it was saved. */
  act(call: HrCall): Promise<boolean>;
  /** The form and letter codes, no sign-in. The screen shows the answer. */
  call<T>(call: PublicCall): Promise<Reply<T>>;
  /** Fetches HR's letters again, for letters filed since. */
  refresh(): Promise<void>;
  notify(message: ReactNode, tone?: ToastTone): void;
  /** Null when signed in, else why not. */
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  /** Null when saved, else why not. */
  setName(name: string): Promise<string | null>;
  /** The local stand-in only: puts the sample data back. */
  resetSampleData(): Promise<void>;
}

const Context = createContext<AppState | null>(null);

export function useApp(): AppState {
  const app = useContext(Context);
  if (!app) throw new Error('useApp() needs an <AppStateProvider> above it.');
  return app;
}

/** The signed-in HR account. Only for screens behind sign-in. */
export function useUser(): User {
  const { user } = useApp();
  if (!user) throw new Error('No one is signed in.');
  return user;
}

type Session =
  | { readonly state: 'starting' }
  | { readonly state: 'out'; readonly settings: Settings }
  | { readonly state: 'hr'; readonly account: HrAccount; readonly db: Db }
  | { readonly state: 'failed'; readonly error: string; readonly account: HrAccount | null };

function dbOf(data: HrData): Db {
  const requests: Record<string, AbsenceRequest> = {};
  for (const r of data.requests) requests[r.id] = r;
  return { requests, absenceSlots: {}, counters: {}, settings: normalizeSettings(data.settings) };
}

const userOf = (a: HrAccount): User => ({ uid: a.uid, email: a.email, name: a.name || a.email, role: 'hr' });

/** HR's letters are fetched again when the window comes back after this long, so new ones show up. */
const STALE_MS = 30_000;

/**
 * Who is signed in and what they see. Signed in, HR's letters are fetched
 * once and each action's changes applied on screen as the server answers;
 * coming back to the window fetches them again. Signed out, only the settings
 * the letter needs.
 */
export function AppStateProvider({ platform, backend, children }: { platform: Platform; backend: Backend; children: ReactNode }) {
  const [session, setSession] = useState<Session>({ state: 'starting' });
  const toasts = useToasts();
  const ticket = useRef(0);
  const loadedAt = useRef(0);
  const account = useRef<HrAccount | null>(null);

  // `show` keeps its identity; the object useToasts() returns does not.
  const { show } = toasts;
  const notify = useCallback((message: ReactNode, tone: ToastTone = 'ok') => void show(message, tone), [show]);

  /** Fetches what `who` sees. `quiet`: keep the screen as it is while fetching, and on a failure only say so. */
  const load = useCallback(
    async (who: HrAccount | null, quiet: boolean) => {
      const mine = ++ticket.current;
      if (!quiet) setSession({ state: 'starting' });
      const next: Session = who
        ? await backend.hrCall<HrData>({ action: 'load' }).then((r) => (r.ok ? { state: 'hr', account: who, db: dbOf(r.value) } : { state: 'failed', error: r.error, account: who }))
        : await backend.publicCall<Settings>({ action: 'settings' }).then((r) => (r.ok ? { state: 'out', settings: normalizeSettings(r.value) } : { state: 'failed', error: r.error, account: null }));
      if (mine !== ticket.current) return;
      if (quiet && next.state === 'failed') {
        notify(`Couldn't fetch the letters: ${next.error}`, 'warn');
        return;
      }
      loadedAt.current = Date.now();
      setSession(next);
    },
    [backend, notify],
  );

  // Subscribed once per backend: subscribing calls back at once, so subscribing
  // again on every render would fetch, render and subscribe again without end.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(
    () =>
      backend.watch((who) => {
        account.current = who;
        void loadRef.current(who, false);
      }),
    [backend],
  );

  const refresh = useCallback(() => load(account.current, true), [load]);

  // New letters arrive on the server: fetch again when HR comes back to the window.
  useEffect(() => {
    if (session.state !== 'hr') return undefined;
    const onFocus = () => {
      if (Date.now() - loadedAt.current > STALE_MS) void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [session.state, refresh]);

  const act = useCallback(
    async (call: HrCall): Promise<boolean> => {
      const reply = await backend.hrCall(call);
      if (!reply.ok) {
        notify(reply.error, 'warn');
        return false;
      }
      const changes = reply.changes;
      if (changes) setSession((s) => (s.state === 'hr' ? { ...s, db: applyChanges(s.db, changes) } : s));
      if (reply.message) notify(reply.message);
      return true;
    },
    [backend, notify],
  );

  const call = useCallback(<T,>(c: PublicCall) => backend.publicCall<T>(c), [backend]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        await backend.signIn(email, password);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    [backend],
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
    notify('Signed out.');
  }, [backend, notify]);

  const setName = useCallback(
    async (name: string): Promise<string | null> => {
      if (name.trim().length < 2) return 'Enter your full name.';
      try {
        const who = await backend.setName(name);
        account.current = who;
        setSession((s) => (s.state === 'hr' ? { ...s, account: who } : s));
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    [backend],
  );

  const resetSampleData = useCallback(async () => {
    if (!backend.sample) return;
    await backend.sample.reset();
    await load(account.current, true);
    notify('Sample data restored.');
  }, [backend, load, notify]);

  const value = useMemo<AppState | null>(() => {
    const base = { platform, backend, act, call, refresh, notify, signIn, signOut, setName, resetSampleData };
    if (session.state === 'out') {
      return { ...base, db: { requests: {}, absenceSlots: {}, counters: {}, settings: session.settings }, user: null, needsName: false, isOfficer: false, mayEditSettings: false };
    }
    if (session.state === 'hr') {
      const user = userOf(session.account);
      const letter = session.db.settings.letter;
      return { ...base, db: session.db, user, needsName: !session.account.name, isOfficer: isHrOfficer(letter, user), mayEditSettings: mayEditSettings(letter, user) };
    }
    return null;
  }, [session, platform, backend, act, call, refresh, notify, signIn, signOut, setName, resetSampleData]);

  if (session.state === 'failed') {
    return (
      <div className="app-message" role="alert">
        <h1>{session.account ? "HR's letters couldn't be fetched" : "Can't reach the server"}</h1>
        <p>{session.error}</p>
        <div className="row">
          <Button variant="primary" onClick={() => void load(session.account, false)}>
            Try again
          </Button>
          {session.account ? (
            <Button variant="ghost" onClick={() => void backend.signOut()}>
              Sign out
            </Button>
          ) : null}
        </div>
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
