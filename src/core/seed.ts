import seedJson from './seed.json';
import { normalizeDb } from './db';
import type { Db } from './types';

/** The sample data: what a fresh install and "Reset sample data" start from. */
export function seedDb(): Db {
  return normalizeDb(seedJson);
}
