/**
 * The platform inside the desktop app: the CSV export goes through the Rust
 * command save_text_file (src-tauri/src/files.rs), and the app draws its own
 * window controls. Everything the window may reach is granted in
 * src-tauri/capabilities/default.json, and nothing else.
 */

import { invoke } from '@tauri-apps/api/core';
import { downloadDir, join } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openPath } from '@tauri-apps/plugin-opener';

import { safeLocal, type Platform } from './index';

/** The folder under Downloads that save_text_file writes to (src-tauri/src/files.rs EXPORT_FOLDER). */
export const EXPORT_FOLDER = 'APG Excuse Letters';

function message(err: unknown): Error {
  return new Error(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Something went wrong.');
}

export function createTauriPlatform(): Platform {
  const win = getCurrentWindow();
  return {
    ...safeLocal(),

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
