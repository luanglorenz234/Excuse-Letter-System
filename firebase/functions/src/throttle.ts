import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

/**
 * Hourly limits on the no-sign-in function, counted for everyone together in
 * throttle/{kind}-{hour}:
 *
 *   - lookup: letter codes that matched nothing. A code is one of about a
 *     billion, so 300 wrong guesses an hour can't find someone else's letter.
 *   - submit: new letters, so nobody can flood HR's list.
 *
 * Counting everyone together, not per address, because the address of a call
 * can be made up and everyone in one office shares one anyway. People typing a
 * code wrong now and then never come near these numbers.
 */
export const HOURLY: Readonly<Record<Kind, number>> = { lookup: 300, submit: 300 };

export type Kind = 'lookup' | 'submit';

const REFUSALS: Readonly<Record<Kind, string>> = {
  lookup: 'Too many wrong letter codes were tried in the last hour. Try again later, or ask HR.',
  submit: 'Too many letters were sent in the last hour. Try again later, or ask HR.',
};

function docOf(fs: Firestore, kind: Kind, now: Date) {
  // yyyy-mm-ddThh in UTC.
  return fs.collection('throttle').doc(`${kind}-${now.toISOString().slice(0, 13)}`);
}

/** Why this kind of call is refused right now, or null. */
export async function throttled(fs: Firestore, kind: Kind, now: Date): Promise<string | null> {
  const snap = await docOf(fs, kind, now).get();
  const count = snap.get('count');
  return typeof count === 'number' && count >= HOURLY[kind] ? REFUSALS[kind] : null;
}

/** Counts one call. `expireAt` lets a Firestore TTL policy delete old hours, if one is set up. */
export async function count(fs: Firestore, kind: Kind, now: Date): Promise<void> {
  await docOf(fs, kind, now).set({ count: FieldValue.increment(1), expireAt: Timestamp.fromMillis(now.getTime() + 2 * 86_400_000) }, { merge: true });
}
