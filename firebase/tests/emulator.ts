import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// The emulator as the tests use it: Firestore and accounts through the Admin SDK
// (`firebase emulators:exec` sets FIRESTORE_EMULATOR_HOST and
// FIREBASE_AUTH_EMULATOR_HOST), and the functions called the way the app's SDK
// calls them. Ports: firebase.json.

export const PROJECT = 'demo-apg-letters';
const REGION = 'asia-southeast1';
const AUTH = 'http://127.0.0.1:9100';
export const FIRESTORE = 'http://127.0.0.1:8100';
const FUNCTIONS = `http://127.0.0.1:5100/${PROJECT}/${REGION}`;
const PASSWORD = 'a-test-password';

export function admin(): App {
  return getApps()[0] ?? initializeApp({ projectId: PROJECT });
}

export const db = () => getFirestore(admin());

/** Empties Firestore and the accounts. */
export async function resetEmulator(): Promise<void> {
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

export const emailOf = (who: string) => `${who}@apg-letters.test`;

/** An HR account, as made in the Firebase console. Its uid. */
export async function makeAccount(who: string, name: string | null = who): Promise<string> {
  const user = await getAuth(admin()).createUser({ email: emailOf(who), password: PASSWORD, ...(name ? { displayName: name } : {}) });
  return user.uid;
}

/** A sign-in token for the account `who`. */
export async function signIn(who: string): Promise<string> {
  const reply = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailOf(who), password: PASSWORD, returnSecureToken: true }),
  });
  const body = (await reply.json()) as { idToken?: string };
  if (!body.idToken) throw new Error(`Couldn't sign in as ${who}: ${JSON.stringify(body)}`);
  return body.idToken;
}

/** A token for an account that signed itself up anonymously: not HR. */
export async function signInAnonymously(): Promise<string> {
  const reply = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body = (await reply.json()) as { idToken?: string };
  if (!body.idToken) throw new Error(`Couldn't sign in anonymously: ${JSON.stringify(body)}`);
  return body.idToken;
}

/** A function's refusal (an HttpsError), as the app's SDK reports it. */
export interface Refusal {
  readonly code: string;
  readonly message: string;
}

/** Calls the function `name` as the account with `token` (none: signed out). Rejects with a Refusal on an HttpsError. */
export async function call<T = unknown>(name: 'publicApi' | 'hrApi', data: unknown, token: string | null = null): Promise<T> {
  const reply = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const body = (await reply.json()) as { result?: T; error?: { status: string; message: string } };
  if (body.error) {
    const refusal: Refusal = { code: `functions/${body.error.status.toLowerCase().replace(/_/g, '-')}`, message: body.error.message };
    throw refusal;
  }
  return body.result as T;
}

/** The refusal of a call that should have been refused. */
export async function refusal(promise: Promise<unknown>): Promise<Refusal> {
  return promise.then(
    () => {
      throw new Error("The call wasn't refused.");
    },
    (e: unknown) => e as Refusal,
  );
}
