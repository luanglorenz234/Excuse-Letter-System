/** Small pieces several screens share. */

import { useEffect, useRef, type ReactNode } from 'react';
import { formatShortDate } from '@/core/dates';
import type { AbsenceRequest, RequestStatus } from '@/core/types';
import { Button, Pill, type Tone } from './components';
import { ScaledLetter, safeImageSrc } from './letter/Letter';
import { useApp } from './state/AppState';

const STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Waiting for HR', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  returned: { label: 'Returned for revision', tone: 'danger' },
  declined: { label: 'Declined', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export function StatusPill({ status }: { status: RequestStatus }) {
  const s = STATUS[status];
  return (
    <Pill tone={s.tone} dot>
      {s.label}
    </Pill>
  );
}

/** "Waiting for paper copy" under a hand-signed letter HR hasn't received yet. */
export function PaperTag({ request: r }: { request: AbsenceRequest }) {
  if (r.signatureMethod !== 'wet-paper' || r.status !== 'submitted') return null;
  const received = r.paperCopy?.status === 'received';
  return <div className="cell-sub">{received ? 'Paper copy received' : 'Waiting for paper copy'}</div>;
}

export function datesText(r: AbsenceRequest): string {
  if (r.type === 'multi') return `${formatShortDate(r.startDate)} – ${formatShortDate(r.endDate)} (${r.days} day${r.days === 1 ? '' : 's'})`;
  return formatShortDate(r.date);
}

export function typeText(r: AbsenceRequest): string {
  if (r.type === 'half') return `Half day · ${r.shift ?? 'morning'}`;
  if (r.type === 'multi') return 'Several days';
  return 'Full day';
}

/** A modal over the window. Escape and the backdrop close it. */
export function Dialog({ title, onClose, actions, children }: { title: ReactNode; onClose: () => void; actions?: ReactNode; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    box.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog__box" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} ref={box}>
        <div className="dialog__head">
          <h2>{title}</h2>
          <div className="row">
            {actions}
            <Button variant="ghost" size="small" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A request's letter in a dialog, with Print for an approved one. */
export function LetterDialog({ request, onClose, onPrint }: { request: AbsenceRequest; onClose: () => void; onPrint?: (() => void) | undefined }) {
  const { db } = useApp();
  return (
    <Dialog
      title={`Letter · ${request.refNo ?? request.id}`}
      onClose={onClose}
      actions={
        onPrint ? (
          <Button size="small" onClick={onPrint}>
            Print / save PDF
          </Button>
        ) : null
      }
    >
      <div className="preview__stage">
        <ScaledLetter request={request} settings={db.settings.letter} highlight={false} maxWidth={800} />
      </div>
    </Dialog>
  );
}

export function PhotoDialog({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const safe = safeImageSrc(src);
  return (
    <Dialog title={title} onClose={onClose}>
      {safe ? <img src={safe} alt={title} style={{ maxWidth: '100%', background: '#fff' }} /> : <p>No photo.</p>}
    </Dialog>
  );
}
