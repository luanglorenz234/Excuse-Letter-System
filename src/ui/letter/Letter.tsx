import { useLayoutEffect, useRef, useState } from 'react';
import { formatShortDate } from '@/core/dates';
import { formatLetterDate, letterDateYmd, openingSegments, wordingFor, type Segment } from '@/core/letter';
import { isGroupRequest, requestMembers, type LetterMember } from '@/core/requests';
import type { AbsenceRequest, LetterSettings } from '@/core/types';
import './letter.css';

export interface LetterOptions {
  /** Gold highlights on what the person typed. Off for print and HR's view. */
  readonly highlight?: boolean | undefined;
  /** The printed letter: no APPROVED stamp, status label or placeholders. */
  readonly clean?: boolean | undefined;
  /** A copy to sign by hand: every signature space left empty. */
  readonly blankSignature?: boolean | undefined;
}

export interface LetterProps extends LetterOptions {
  readonly request: AbsenceRequest;
  readonly settings: LetterSettings;
}

/** Only inline image data (drawn or uploaded signatures) may be an image source. */
export function safeImageSrc(src: string | null | undefined): string {
  return typeof src === 'string' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(src) ? src : '';
}

function Segments({ parts, highlight }: { parts: readonly Segment[]; highlight: boolean }) {
  return (
    <>
      {parts.map((p, i) =>
        p.placeholder ? (
          <span key={i} className="a4-var a4-var--placeholder">
            {p.text}
          </span>
        ) : p.typed && highlight ? (
          <span key={i} className="a4-var">
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

/** The space above a name: a drawn signature, a note about a hand-signed copy, or nothing. */
function MemberSignature({ req, member, first, blank, clean }: { req: AbsenceRequest; member: LetterMember; first: boolean; blank: boolean; clean: boolean }) {
  if (blank) return <div className="a4-sig" />;
  if (req.signatureMethod !== 'digital') {
    if (!first) return <div className="a4-sig" />;
    const note =
      req.signatureMethod === 'wet-upload'
        ? 'Signed by hand · photo on file with HR'
        : `Signed by hand · paper copy ${req.paperCopy?.status === 'received' ? 'received by HR' : 'to be handed in to HR'}`;
    return (
      <div className="a4-sig">
        <span className="a4-sig__note">{note}</span>
      </div>
    );
  }
  const src = safeImageSrc(member.signature);
  return (
    <div className="a4-sig">
      {src ? <img src={src} alt={`Signature of ${member.name}`} /> : clean ? null : <span className="a4-sig__placeholder">[Signature required]</span>}
    </div>
  );
}

/**
 * The official letter on the 2026 letterhead, exactly one A4 page, rebuilt
 * from the request every time. The member type picks the format: interns
 * close "Respectfully," and are noted by HR; employees close "Very
 * respectfully yours," with their position, noted by the CEO and HR.
 */
export function Letter({ request: req, settings, highlight = true, clean = false, blankSignature = false }: LetterProps) {
  const wording = wordingFor(req, settings);
  const employee = req.memberType === 'employee';
  const group = isGroupRequest(req);
  const members = requestMembers(req);
  const letterYmd = letterDateYmd(req);
  const approved = req.status === 'approved';
  const hrSig = approved ? safeImageSrc(req.review?.hrSignature) : '';
  const content = useRef<HTMLDivElement>(null);

  // A long reason or a big group can run past the footer: shrink the type a step at a time until it fits.
  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    let fit = 1;
    el.style.setProperty('--fit', '1');
    let height = el.scrollHeight;
    while (height > el.clientHeight + 1 && fit > 0.8) {
      fit = Math.round((fit - 0.025) * 1000) / 1000;
      el.style.setProperty('--fit', String(fit));
      const next = el.scrollHeight;
      // A page that isn't being drawn (a hidden window) doesn't re-measure: stop rather than shrink for nothing.
      if (next >= height) break;
      height = next;
    }
  });

  return (
    <div className="a4-sheet">
      {!clean && approved ? (
        <div className="a4-approval-stamp">
          <div className="a4-approval-stamp__title">✓ APPROVED</div>
          <div className="a4-approval-stamp__ref">REF: {req.refNo ?? '—'}</div>
          <div className="a4-approval-stamp__date">Date: {req.review?.at ? formatShortDate(req.review.at) : formatLetterDate(letterYmd)}</div>
        </div>
      ) : null}
      {!clean && !approved && req.status !== 'draft' ? <div className="a4-status-watermark">Status: {req.status}</div> : null}

      <div className={`a4-content a4-content--${employee ? 'employee' : 'intern'}`} ref={content}>
        <p className="a4-block">{formatLetterDate(letterYmd)}</p>

        <p className="a4-block a4-bold">
          {settings.signatoryName}
          <br />
          {settings.companyName}
          <br />
          {settings.signatoryTitle}
        </p>

        <p className="a4-block a4-bold a4-subject">Subject: {settings.subject}</p>

        <p className="a4-block">{wording.salutation}</p>

        <p className="a4-block a4-justify">
          <Segments parts={openingSegments(req, letterYmd)} highlight={highlight} />
        </p>
        <p className="a4-block a4-justify">{group ? wording.apologyParagraphGroup : wording.apologyParagraph}</p>
        <p className="a4-block a4-thanks">{group ? wording.thankYouParagraphGroup : wording.thankYouParagraph}</p>

        <p className="a4-line">{wording.closing}</p>
        <div className={`a4-signers${members.length > 1 ? ' a4-signers--group' : ''}`}>
          {members.map((m, i) => (
            <div key={i} className="a4-signer">
              <MemberSignature req={req} member={m} first={i === 0} blank={blankSignature} clean={clean} />
              <div className="a4-line">{m.name || '[Name]'}</div>
              {employee && m.position ? <div className="a4-line">{m.position}</div> : null}
            </div>
          ))}
        </div>

        <p className="a4-line a4-noted">Noted by:</p>
        {wording.notedBy.map((n, i) => {
          const signs = n.name === settings.signatoryName;
          return (
            <div key={i} className="a4-signer">
              <div className="a4-sig">
                {signs && hrSig && !blankSignature ? (
                  <img src={hrSig} alt={`Signature of ${n.name}`} />
                ) : signs && !approved && !clean && !blankSignature ? (
                  <span className="a4-sig__placeholder">[Signed by HR on approval]</span>
                ) : null}
              </div>
              <div className="a4-line">{n.name}</div>
              {n.title ? <div className="a4-line">{n.title}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/** The letter scaled down to fit the width it is given, layout unchanged. */
export function ScaledLetter(props: LetterProps & { readonly maxWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useLayoutEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, (props.maxWidth ?? el.clientWidth) / A4_WIDTH));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [props.maxWidth]);
  return (
    <div ref={ref} className="letter-frame" style={{ width: A4_WIDTH * scale, height: A4_HEIGHT * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: A4_WIDTH, height: A4_HEIGHT }}>
        <Letter {...props} />
      </div>
    </div>
  );
}

