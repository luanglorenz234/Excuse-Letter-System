/**
 * The apg-letters Firebase project (or its emulator): email and password
 * sign-in for HR, and the two callable functions in firebase/functions. The
 * app never reads Firestore itself; the database is closed to it
 * (firebase/firestore.rules) and the functions decide what each call may do.
 * Follows APG Post-It's src/platform/firebase.ts.
 */

import { FirebaseError, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import type { Backend, HrAccount, Reply } from './types';

export interface FirebaseTarget {
  readonly kind: 'live' | 'emulator';
  readonly config: FirebaseOptions;
  readonly emulator: { readonly auth: string; readonly host: string; readonly port: number } | null;
}

/** The live project's web app. The API key only names the project; it is not a secret. */
export const LIVE: FirebaseTarget = {
  kind: 'live',
  config: {
    apiKey: 'AIzaSyBNMnk6VX2BkkeAUKH6_5q1pyuQd_eC6E4',
    authDomain: 'apg-letters.firebaseapp.com',
    projectId: 'apg-letters',
    appId: '1:136913140800:web:e0acf55dd923ae6abcf3a5',
  },
  emulator: null,
};

/** The emulator on this PC (firebase/firebase.json's ports): a `demo-` project, which never reaches a real one. */
export const EMULATOR: FirebaseTarget = {
  kind: 'emulator',
  config: { apiKey: 'demo-key', authDomain: 'demo-apg-letters.firebaseapp.com', projectId: 'demo-apg-letters' },
  emulator: { auth: 'http://127.0.0.1:9100', host: '127.0.0.1', port: 5100 },
};

/** The functions' region (firebase/functions/src/index.ts). */
export const REGION = 'asia-southeast1';

const accountOf = (u: FirebaseUser): HrAccount => ({ uid: u.uid, email: u.email ?? '', name: u.displayName?.trim() ?? '' });

/** A sign-in failure, in words. */
export function signInError(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/invalid-email':
      return 'Enter the email address of your HR account.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/user-disabled':
      return 'This account has been switched off. Ask whoever manages the Firebase project.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return "Can't reach the sign-in server. Check the internet connection.";
    default:
      return err instanceof Error ? err.message : 'Signing in failed. Try again.';
  }
}

/** A function call that failed before the handlers could answer, in words. */
export function callError(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : '';
  switch (code) {
    case 'functions/unauthenticated':
      return 'Your sign-in has run out. Sign out and sign in again.';
    case 'functions/permission-denied':
      return err instanceof FirebaseError ? err.message : 'Not allowed.';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
    case 'functions/internal':
      return code === 'functions/internal' && err instanceof FirebaseError && err.message !== 'internal'
        ? err.message
        : "Can't reach the server. Check the internet connection and try again.";
    default:
      return err instanceof Error ? err.message : 'Something went wrong. Try again.';
  }
}

let made = 0;

/**
 * Firebase for `target`. The sign-in is kept in the WebView's IndexedDB
 * (localStorage as a fallback), so HR stays signed in across restarts.
 */
export function createFirebaseBackend(target: FirebaseTarget): Backend {
  const app = initializeApp(target.config, `letters-${++made}`);
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  const functions = getFunctions(app, REGION);
  if (target.emulator) {
    connectAuthEmulator(auth, target.emulator.auth, { disableWarnings: true });
    connectFunctionsEmulator(functions, target.emulator.host, target.emulator.port);
  }
  const publicApi = httpsCallable<unknown, Reply<never>>(functions, 'publicApi');
  const hrApi = httpsCallable<unknown, Reply<never>>(functions, 'hrApi');

  async function call<T>(fn: typeof publicApi, data: unknown): Promise<Reply<T>> {
    try {
      return (await fn(data)).data as Reply<T>;
    } catch (err) {
      return { ok: false, error: callError(err) };
    }
  }

  return {
    kind: target.kind,
    label: target.kind === 'live' ? 'Firebase (apg-letters)' : 'the Firebase emulator on this PC',
    publicCall: (c) => call(publicApi, c),
    hrCall: (c) => call(hrApi, c),
    watch(changed) {
      return onAuthStateChanged(auth, (u) => changed(u ? accountOf(u) : null));
    },
    async signIn(email, password) {
      try {
        return accountOf((await signInWithEmailAndPassword(auth, email.trim(), password)).user);
      } catch (err) {
        throw new Error(signInError(err));
      }
    },
    signOut: () => signOut(auth),
    async setName(name) {
      const u = auth.currentUser;
      if (!u) throw new Error('Sign in first.');
      try {
        await updateProfile(u, { displayName: name.trim() });
      } catch (err) {
        throw new Error(callError(err));
      }
      return accountOf(u);
    },
    sample: null,
  };
}
