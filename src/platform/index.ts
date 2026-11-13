/**
 * The only way from the screens to the OS, as in APG Post-It: files, the
 * window, and small per-viewer values. The letters themselves are on the
 * server (src/backend).
 *
 * Three versions: Tauri's (tauri.ts), the desktop app; a plain browser's
 * (browser.ts), for `npm run dev`; and an in-memory one (memory.ts) for tests.
 */

export interface Platform {
  /**
   * Saves a text file the person asked for (the CSV export). Returns where it
   * went, in words to show them.
   */
  saveTextFile(fileName: string, contents: string): Promise<string>;
  /** Opens the folder files are saved to, where there is one. */
  readonly openExportFolder: (() => Promise<void>) | null;

  /** Per-viewer values that may be lost without harm: who is signed in, the sidebar. */
  readLocal(key: string): string | null;
  writeLocal(key: string, value: string | null): void;

  // ---- the window ---------------------------------------------------------
  // The desktop window has no frame of its own, so the app draws minimize,
  // maximize and close. In a browser there is none: hasWindowControls is false.
  readonly hasWindowControls: boolean;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(handler: (maximized: boolean) => void): () => void;
  close(): Promise<void>;
}

let current: Platform | null = null;

export function setPlatform(p: Platform): void {
  current = p;
}

export function platform(): Platform {
  if (!current) throw new Error('No platform set. Call setPlatform() at start-up.');
  return current;
}

/** localStorage, guarded: it can be blocked or full, and nothing kept there matters much. */
export function safeLocal(): Pick<Platform, 'readLocal' | 'writeLocal'> {
  return {
    readLocal(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    writeLocal(key, value) {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        // Not kept: the person signs in again next time.
      }
    },
  };
}

export const noWindow = {
  hasWindowControls: false,
  minimize: async () => {},
  toggleMaximize: async () => {},
  isMaximized: async () => false,
  onMaximizedChange: () => () => {},
  close: async () => {},
} satisfies Partial<Platform>;
