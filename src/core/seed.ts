import seedJson from './seed.json';
import { normalizeDb } from './db';
import { rebuildSlots } from './requests';
import type { Db } from './types';

/**
 * The sample data: what a fresh install and "Reset sample data" start from.
 * The half-days taken are worked out from the letters, so they always match
 * the duplicate guard's rules.
 */
export function seedDb(): Db {
  const db = normalizeDb(seedJson);
  return { ...db, absenceSlots: rebuildSlots(db.requests) };
}
