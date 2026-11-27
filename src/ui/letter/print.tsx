import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { formatAccessCode, namesShort } from '@/core/requests';
import type { AbsenceRequest, LetterSettings } from '@/core/types';
import { Letter, type LetterOptions } from './Letter';

let root: Root | null = null;

function cleanPart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

/** Suggested filename when printing or saving a letter as PDF. */
export function letterPrintTitle(request: AbsenceRequest): string {
  const prefix = request.refNo || (request.accessCode ? formatAccessCode(request.accessCode) : 'Notice of Absence');
  const who = namesShort(request);
  const when = request.type === 'multi' ? (request.startDate ?? '') : (request.date ?? '');
  return [prefix, who, when].map(cleanPart).filter(Boolean).join(' - ') || 'APG Excuse Letter';
}

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
  const previousTitle = document.title;
  document.title = letterPrintTitle(request);
  try {
    window.print();
  } finally {
    document.title = previousTitle;
  }
}
