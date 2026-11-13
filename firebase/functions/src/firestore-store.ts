import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import { normalizeRequest } from '@/core/db';
import type { AbsenceRequest, Changes, Counter, Settings, Slot } from '@/core/types';
import type { Store, Tx } from '@/server/store';

/**
 * The handlers' store on Firestore:
 *
 *   requests/{id}       one letter, its history and HR's comments
 *   slots/{key}         one person's half-day, `{person}_{yyyy-mm-dd}_{am|pm}`: a second letter for it is refused
 *   config/settings     the letter settings, and who the HR officer is
 *   config/counters     the next reference number for each year
 *
 * Every action runs in one Firestore transaction. If two people take the same
 * half-day or the same reference number at once, Firestore runs one of them
 * again on the new data, and the rule refuses or renumbers it.
 */
export class FirestoreStore implements Store {
  constructor(private readonly fs: Firestore) {}

  private requestRef(id: string): DocumentReference {
    return this.fs.collection('requests').doc(id);
  }

  private slotRef(key: string): DocumentReference {
    return this.fs.collection('slots').doc(key);
  }

  private get settingsRef(): DocumentReference {
    return this.fs.collection('config').doc('settings');
  }

  private get countersRef(): DocumentReference {
    return this.fs.collection('config').doc('counters');
  }

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.fs.runTransaction(async (t) => {
      let pending: Changes | null = null;
      const tx: Tx = {
        request: async (id) => {
          const snap = await t.get(this.requestRef(id));
          return snap.exists ? toRequest(snap.id, snap.data()) : null;
        },
        requestByCode: async (code) => {
          const found = await t.get(this.fs.collection('requests').where('accessCode', '==', code).limit(1));
          const doc = found.docs[0];
          return doc ? toRequest(doc.id, doc.data()) : null;
        },
        slots: async (keys) => {
          if (keys.length === 0) return {};
          const snaps = await t.getAll(...[...new Set(keys)].map((k) => this.slotRef(k)));
          return Object.fromEntries(snaps.flatMap((s) => (s.exists ? [[s.id, toSlot(s.data())]] : [])));
        },
        slotsOf: async (id) => {
          const found = await t.get(this.fs.collection('slots').where('requestId', '==', id));
          return Object.fromEntries(found.docs.map((d) => [d.id, toSlot(d.data())]));
        },
        settings: async () => (await t.get(this.settingsRef)).data() as Settings,
        counters: async () => ((await t.get(this.countersRef)).data() ?? {}) as Record<string, Counter>,
        write(changes) {
          if (pending) throw new Error('One write per transaction.');
          pending = changes;
        },
      };
      const result = await fn(tx);
      if (pending) this.writeAll(t, pending);
      return result;
    });
  }

  /** The changes as Firestore writes, after every read. */
  private writeAll(t: Transaction, changes: Changes): void {
    for (const r of changes.requests ?? []) t.set(this.requestRef(r.id), r);
    const put = changes.putSlots ?? {};
    for (const key of changes.deleteSlots ?? []) if (!(key in put)) t.delete(this.slotRef(key));
    for (const [key, slot] of Object.entries(put)) t.set(this.slotRef(key), slot);
    if (changes.settings) t.set(this.settingsRef, changes.settings);
    if (changes.counters) t.set(this.countersRef, changes.counters, { merge: true });
  }

  async allRequests(): Promise<AbsenceRequest[]> {
    const all = await this.fs.collection('requests').get();
    return all.docs.map((d) => toRequest(d.id, d.data()));
  }

  async settings(): Promise<Settings> {
    return (await this.settingsRef.get()).data() as Settings;
  }
}

function toRequest(id: string, data: Record<string, unknown> | undefined): AbsenceRequest {
  return normalizeRequest({ ...(data ?? {}), id });
}

function toSlot(data: Record<string, unknown> | undefined): Slot {
  return { requestId: String(data?.requestId ?? ''), uid: String(data?.uid ?? '') };
}
