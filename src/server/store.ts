/**
 * Where the handlers read and write. Two versions: Firestore in the Cloud
 * Functions (firebase/functions/src/firestore-store.ts), and an in-memory one
 * (memory-store.ts) for the tests and for `npm run dev` without Firebase.
 */

import type { AbsenceRequest, Changes, Counter, Settings, Slot } from '@/core/types';

/**
 * One transaction: every read first, then at most one write of the action's
 * changes, as Firestore requires. If someone else changed what was read in the
 * meantime, Firestore runs the whole action again on the new data.
 */
export interface Tx {
  request(id: string): Promise<AbsenceRequest | null>;
  /** The letter with this code (normalized, "K7Q4MZ"), or null. */
  requestByCode(code: string): Promise<AbsenceRequest | null>;
  /** The half-days already taken among `keys`. */
  slots(keys: readonly string[]): Promise<Record<string, Slot>>;
  /** The half-days one letter holds. */
  slotsOf(requestId: string): Promise<Record<string, Slot>>;
  settings(): Promise<Settings>;
  counters(): Promise<Record<string, Counter>>;
  /** Called once, after every read. */
  write(changes: Changes): void;
}

export interface Store {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Every letter, for HR's screens. */
  allRequests(): Promise<AbsenceRequest[]>;
  settings(): Promise<Settings>;
}
