/** A platform with no OS at all, for tests: the data lives in a variable. */

import { applyChanges, normalizeDb } from '@/core/db';
import type { Changes, Db } from '@/core/types';
import { noWindow, type Platform } from './index';

export interface MemoryPlatform extends Platform {
  readonly commits: Changes[];
  readonly files: { name: string; contents: string }[];
  db(): Db | null;
}

export function createMemoryPlatform(start: Db | null = null): MemoryPlatform {
  let db = start;
  const local = new Map<string, string>();
  const commits: Changes[] = [];
  const files: { name: string; contents: string }[] = [];
  return {
    storageLabel: 'memory',
    commits,
    files,
    db: () => db,
    async loadDb() {
      return db;
    },
    async commit(changes) {
      commits.push(changes);
      db = applyChanges(db ?? normalizeDb({}), changes);
    },
    async reset(changes) {
      db = applyChanges(normalizeDb({}), changes);
    },
    async saveTextFile(name, contents) {
      files.push({ name, contents });
      return name;
    },
    openExportFolder: null,
    readLocal: (k) => local.get(k) ?? null,
    writeLocal: (k, v) => (v === null ? local.delete(k) : local.set(k, v)),
    ...noWindow,
  };
}
