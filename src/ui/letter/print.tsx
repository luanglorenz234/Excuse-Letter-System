import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { AbsenceRequest, LetterSettings } from '@/core/types';
import { Letter, type LetterOptions } from './Letter';

let root: Root | null = null;

/**
 * Puts the clean official letter into #print-root and opens the print dialog
 * (print, or "Save as PDF"). The rest of the window is hidden while printing
 * (letter.css), so the page is exactly the one A4 letter.
 */
export async function printLetter(request: AbsenceRequest, settings: LetterSettings, options: LetterOptions = {}): Promise<void> {
  const mount = document.getElementById('print-root');
  if (!mount) return;
  root ??= createRoot(mount);
  flushSync(() => {
    root?.render(<Letter request={request} settings={settings} highlight={false} clean {...options} />);
  });
  // Signatures are images: wait for them so the printed page isn't missing any.
  await Promise.all(
    Array.from(mount.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.addEventListener('load', () => resolve(), { once: true }); img.addEventListener('error', () => resolve(), { once: true }); }),
    ),
  );
  window.print();
}
