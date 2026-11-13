/** A platform with no OS at all, for tests. */

import { noWindow, type Platform } from './index';

export interface MemoryPlatform extends Platform {
  readonly files: { name: string; contents: string }[];
}

export function createMemoryPlatform(): MemoryPlatform {
  const local = new Map<string, string>();
  const files: { name: string; contents: string }[] = [];
  return {
    files,
    async saveTextFile(name, contents) {
      files.push({ name, contents });
      return name;
    },
    openExportFolder: null,
    readLocal: (k) => local.get(k) ?? null,
    writeLocal: (k, v) => void (v === null ? local.delete(k) : local.set(k, v)),
    ...noWindow,
  };
}
