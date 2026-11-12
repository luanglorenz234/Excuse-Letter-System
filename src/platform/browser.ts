/**
 * The platform in a plain browser (`npm run dev`): the same app, with the data
 * kept in this browser's localStorage instead of SQLite. For trying screens
 * quickly; the desktop app is the real thing.
 */

import { applyChanges, normalizeDb } from '@/core/db';
import type { Db } from '@/core/types';
import { noWindow, safeLocal, type Platform } from './index';

export const BROWSER_DB_KEY = 'apg-excuse-letters/db';

export function createBrowserPlatform(): Platform {
  const local = safeLocal();
  let cache: Db | null = null;

  const read = (): Db | null => {
    if (cache) return cache;
    const raw = local.readLocal(BROWSER_DB_KEY);
    if (!raw) return null;
    try {
      cache = normalizeDb(JSON.parse(raw));
      return cache;
    } catch {
      return null;
    }
  };
  const write = (db: Db) => {
    cache = db;
    local.writeLocal(BROWSER_DB_KEY, JSON.stringify(db));
  };
  const empty: Db = normalizeDb({});

  return {
    storageLabel: 'this browser (development)',
    ...local,
    async loadDb() {
      return read();
    },
    async commit(changes) {
      write(applyChanges(read() ?? empty, changes));
    },
    async reset(changes) {
      write(applyChanges(empty, changes));
    },
    async saveTextFile(fileName, contents) {
      const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return `your browser's downloads (${fileName})`;
    },
    openExportFolder: null,
    ...noWindow,
  };
}
