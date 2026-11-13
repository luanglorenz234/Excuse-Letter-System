/**
 * The Excuse Letters server on the apg-letters Firebase project.
 *
 *   publicApi   the absence form and the letter code: no sign-in
 *   hrApi       HR, signed in with an account made in the Firebase console
 *
 * Both run the handlers in src/server/handlers.ts, the same ones the app runs
 * on its own in `npm run dev` without Firebase.
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { hrCall, publicCall, type Reply } from '@/server/handlers';
import type { User } from '@/core/types';
import { FirestoreStore } from './firestore-store';
import { count, throttled } from './throttle';

initializeApp();
// Manila's nearest region, as the Listing Hub and Post-It use.
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

const fs = getFirestore();
fs.settings({ ignoreUndefinedProperties: true });
const store = new FirestoreStore(fs);

const LOOKUPS = new Set(['open', 'revise', 'withdraw']);

function actionOf(data: unknown): string {
  return typeof data === 'object' && data !== null && typeof (data as { action?: unknown }).action === 'string' ? (data as { action: string }).action : '';
}

/** Anything the handlers didn't expect: logged, and a plain sentence for the app. */
function failed(err: unknown, where: string): never {
  logger.error(`${where} failed`, err);
  throw new HttpsError('internal', 'Something went wrong on the server. Try again in a minute.');
}

// invoker "public": anyone may reach the function; the handlers decide what a call may do.
export const publicApi = onCall({ invoker: 'public', memory: '512MiB' }, async (request: CallableRequest<unknown>): Promise<Reply> => {
  const now = new Date();
  const action = actionOf(request.data);
  const kind = action === 'submit' ? 'submit' : LOOKUPS.has(action) ? 'lookup' : null;
  try {
    if (kind) {
      const refusal = await throttled(fs, kind, now);
      if (refusal) return { ok: false, error: refusal };
    }
    const reply = await publicCall(store, request.data, now);
    if (kind === 'lookup' && !reply.ok && reply.notFound) await count(fs, 'lookup', now);
    if (kind === 'submit' && reply.ok) await count(fs, 'submit', now);
    return reply;
  } catch (err) {
    return failed(err, `publicApi ${action}`);
  }
});

/**
 * Who is calling, as HR. Every account on the project is HR, because accounts
 * are only made in the Firebase console (sign-up from the app is switched off
 * in Authentication → Settings). The name is the account's display name, which
 * the app asks for on the first sign-in.
 */
async function hrOf(request: CallableRequest<unknown>): Promise<User> {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in as HR first.');
  const email = auth.token.email;
  if (auth.token.firebase.sign_in_provider !== 'password' || !email) {
    throw new HttpsError('permission-denied', 'Only HR accounts can do this.');
  }
  // A switched-off account's sign-in keeps working for up to an hour; this ends it at once.
  const account = await getAuth().getUser(auth.uid);
  if (account.disabled) throw new HttpsError('permission-denied', 'This account has been switched off.');
  return { uid: auth.uid, name: account.displayName?.trim() || email, email: email.toLowerCase(), role: 'hr' };
}

export const hrApi = onCall({ invoker: 'public', memory: '512MiB' }, async (request: CallableRequest<unknown>): Promise<Reply> => {
  const hr = await hrOf(request);
  try {
    return await hrCall(store, hr, request.data, new Date());
  } catch (err) {
    return failed(err, `hrApi ${actionOf(request.data)}`);
  }
});
