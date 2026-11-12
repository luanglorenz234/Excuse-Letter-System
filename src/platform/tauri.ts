/**
 * The platform inside the desktop app: the data goes to SQLite through the
 * Rust commands in src-tauri/src (db_load, db_commit, db_reset), the CSV export
 * through save_text_file. Everything the window may reach is granted in
 * src-tauri/capabilities/default.json, and nothing else.
 */

import { invoke } from '@tauri-apps/api/core';
import { downloadDir, join } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openPath } from '@tauri-apps/plugin-opener';

import { normalizeDb } from '@/core/db';
import type { Changes } from '@/core/types';
import { safeLocal, type Platform } from './index';

/** The folder under Downloads that save_text_file writes to (src-tauri/src/files.rs EXPORT_FOLDER). */
export const EXPORT_FOLDER = 'APG Excuse Letters';

function message(err: unknown): Error {
  return new Error(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Something went wrong.');
}

export function createTauriPlatform(): Platform {
  const win = getCurrentWindow();
  return {
    storageLabel: 'SQLite on this PC',
    ...safeLocal(),

    async loadDb() {
      try {
        const snapshot = await invoke<unknown>('db_load');
        return snapshot ? normalizeDb(snapshot) : null;
      } catch (err) {
        throw message(err);
      }
    },
    async commit(changes: Changes) {
      try {
        await invoke('db_commit', { changes });
      } catch (err) {
        throw message(err);
      }
    },
    async reset(changes: Changes) {
      try {
        await invoke('db_reset', { changes });
      } catch (err) {
        throw message(err);
      }
    },

    async saveTextFile(fileName, contents) {
      try {
        return await invoke<string>('save_text_file', { fileName, contents });
      } catch (err) {
        throw message(err);
      }
    },
    async openExportFolder() {
      await openPath(await join(await downloadDir(), EXPORT_FOLDER));
    },

    hasWindowControls: true,
    minimize: () => win.minimize(),
    toggleMaximize: () => win.toggleMaximize(),
    isMaximized: () => win.isMaximized(),
    onMaximizedChange(handler) {
      let stopped = false;
      let stop: (() => void) | null = null;
      void win
        .onResized(async () => handler(await win.isMaximized()))
        .then((unlisten) => {
          if (stopped) unlisten();
          else stop = unlisten;
        });
      return () => {
        stopped = true;
        stop?.();
      };
    },
    close: () => win.close(),
  };
}
