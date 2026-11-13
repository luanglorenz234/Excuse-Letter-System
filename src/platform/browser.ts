/** The platform in a plain browser (`npm run dev`): downloads instead of the Downloads folder, and no window controls. */

import { noWindow, safeLocal, type Platform } from './index';

export function createBrowserPlatform(): Platform {
  return {
    ...safeLocal(),
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
