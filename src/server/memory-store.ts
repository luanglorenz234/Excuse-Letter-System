import { applyChanges } from '@/core/db';
import type { Changes, Db } from '@/core/types';
import type { Store, Tx } from './store';

/**
 * The store in memory: the tests, and `npm run dev` without Firebase (the
 * local stand-in keeps it in the browser's localStorage through `onChange`).
 * Transactions run one after another, so they behave like Firestore's.
 */
export class MemoryStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private db: Db,
    private readonly onChange: ((db: Db) => void) | null = null,
  ) {}

  /** What is stored now. */
  snapshot(): Db {
    return this.db;
  }

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const db = this.db;
      let pending: Changes | null = null;
      const tx: Tx = {
        request: async (id) => db.requests[id] ?? null,
        requestByCode: async (code) => Object.values(db.requests).find((r) => r.accessCode === code) ?? null,
        slots: async (keys) => Object.fromEntries(keys.flatMap((k) => (db.absenceSlots[k] ? [[k, db.absenceSlots[k]]] : []))),
        slotsOf: async (id) => Object.fromEntries(Object.entries(db.absenceSlots).filter(([, s]) => s.requestId === id)),
        settings: async () => db.settings,
        counters: async () => db.counters,
        write(changes) {
          if (pending) throw new Error('One write per transaction.');
          pending = changes;
        },
      };
      const result = await fn(tx);
      if (pending) {
        this.db = applyChanges(this.db, pending);
        this.onChange?.(this.db);
      }
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async allRequests() {
    return Object.values(this.db.requests);
  }

  async settings() {
    return this.db.settings;
  }
}
