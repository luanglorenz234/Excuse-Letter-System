import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { countWeekdays, currentYear, formatLongDate, formatShortDate, formatStandardDate, todayYmd } from '@/core/dates';
import { DEFAULT_TIME_RANGE, isGroupRequest, requestMembers } from '@/core/requests';
import type { AbsenceRequest, LetterSettings } from '@/core/types';
import './letter.css';

export interface LetterOptions {
  /** Gold highlights on what the person typed. Off for print and HR's view. */
  readonly highlight?: boolean | undefined;
  /** The printed letter: no APPROVED stamp or status label. */
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

/**
 * "IT Associate Intern" → "IT <em>Associate Intern</em>", the way the official
 * letters set the position.
 */
function Position({ value }: { value: string }) {
  const m = /^(.*?)\s*(Associate\s+Intern|\b\w+\s+Intern)$/i.exec(value);
  if (m && m[1]) {
    return (
      <>
        {m[1]} <em>{m[2]}</em>
      </>
    );
  }
  return <em>{value}</em>;
}

function Opening({ req, v }: { req: AbsenceRequest; v: (text: string) => ReactNode }) {
  const group = isGroupRequest(req);
  const types = new Set(requestMembers(req).map((m) => m.memberType));
  const duty = types.size > 1 ? 'duties' : req.memberType === 'employee' ? 'work duties' : 'internship duties';
  const lead = `${group ? 'We' : 'I'} respectfully request permission to be absent from ${group ? 'our' : 'my'} ${duty}`;

  if (req.type === 'half') {
    const shift = req.shift ?? 'morning';
    return (
      <>
        {lead} during the {v(shift)} shift ({v(req.timeRange || DEFAULT_TIME_RANGE[shift])}) of {v(formatLongDate(req.date))}.
      </>
    );
  }
  if (req.type === 'multi') {
    const n = req.startDate && req.endDate ? countWeekdays(req.startDate, req.endDate) : req.days;
    return (
      <>
        {lead} from {v(formatLongDate(req.startDate))} to {v(formatLongDate(req.endDate))} ({v(`${n} ${n === 1 ? 'day' : 'days'}`)}).
      </>
    );
  }
  return (
    <>
      {lead} on {v(formatLongDate(req.date))}.
    </>
  );
}

function MemberSignatures({ req, blank }: { req: AbsenceRequest; blank: boolean }) {
  if (blank) return <div className="a4-sig-space" />;
  if (req.signatureMethod === 'wet-upload') {
    return (
      <div className="a4-sig-space">
        <span className="a4-wet-note">Signed by hand · photo on file with HR</span>
      </div>
    );
  }
  if (req.signatureMethod === 'wet-paper') {
    const received = req.paperCopy?.status === 'received';
    return (
      <div className="a4-sig-space">
        <span className="a4-wet-note">Signed by hand · paper copy {received ? 'received by HR' : 'to be handed in to HR'}</span>
      </div>
    );
  }
  const sigs = requestMembers(req)
    .map((m) => safeImageSrc(m.signature))
    .filter(Boolean);
  if (sigs.length === 0) {
    return (
      <div className="a4-sig-space">
        <span className="a4-sig-placeholder">[Signature required]</span>
      </div>
    );
  }
  return (
    <div className={`a4-sig-space${sigs.length > 1 ? ' a4-sig-space--many' : ''}`}>
      {sigs.map((src, i) => (
        <img key={i} src={src} alt="Member signature" />
      ))}
    </div>
  );
}

/** The official letter on the letterhead, exactly one A4 page, rebuilt from the request every time. */
export function Letter({ request: req, settings, highlight = true, clean = false, blankSignature = false }: LetterProps) {
  const v = (text: string): ReactNode => (highlight ? <span className="a4-var">{text}</span> : text);
  const filed = formatStandardDate((req.submittedAt ?? req.createdAt ?? todayYmd()).slice(0, 10));
  const approved = req.status === 'approved';
  const hrSig = approved ? safeImageSrc(req.review?.hrSignature) : '';
  const group = isGroupRequest(req);
  const members = requestMembers(req);

  return (
    <div className="a4-sheet">
      {!clean && approved ? (
        <div className="a4-approval-stamp">
          <div className="a4-approval-stamp__title">✓ APPROVED</div>
          <div className="a4-approval-stamp__ref">REF: {req.refNo ?? `APG-EL-${currentYear()}-XXXX`}</div>
          <div className="a4-approval-stamp__date">Date: {req.review?.at ? formatShortDate(req.review.at) : filed}</div>
        </div>
      ) : null}
      {!clean && !approved && req.status !== 'draft' ? <div className="a4-status-watermark">Status: {req.status}</div> : null}

      <div className="a4-content">
        <div className="a4-meta-row">
          <div className="a4-address">{settings.addressBlock}</div>
          <div className="a4-date">Date: {filed}</div>
        </div>
        <div className="a4-subject">SUBJECT: {settings.subject}</div>
        <div className="a4-salutation">{settings.salutation || "Good day, Ma'am!"}</div>

        <p className="a4-p">
          <Opening req={req} v={v} />
        </p>
        <p className="a4-p">
          {req.reasonDetails ? (
            v(req.reasonDetails)
          ) : (
            <span className="a4-var a4-var--placeholder">[The reason for the absence appears here, 30 to 400 characters.]</span>
          )}
        </p>
        <p className="a4-p">{group ? settings.apologyParagraphGroup : settings.apologyParagraph}</p>
        <p className="a4-p">{group ? settings.thankYouParagraphGroup : settings.thankYouParagraph}</p>

        <div className="a4-signatures">
          <div className="a4-sig-col">
            <div className="a4-sig-greeting">Sincerely,</div>
            <MemberSignatures req={req} blank={blankSignature} />
            <div className="a4-names">
              {members.map((m, i) => (
                <div key={i} className="a4-name">
                  {m.name || '[Name]'}
                </div>
              ))}
            </div>
            <div className="a4-title">
              <Position value={members[0]?.position || req.snapshot.position} />
            </div>
          </div>
          <div className="a4-sig-col">
            <div className="a4-sig-greeting a4-sig-greeting--hidden">Sincerely,</div>
            <div className="a4-sig-space">
              {hrSig ? (
                <img src={hrSig} alt="HR officer signature" />
              ) : approved || blankSignature ? null : (
                <span className="a4-sig-placeholder">[Signed by HR on approval]</span>
              )}
            </div>
            <div className="a4-name">{settings.signatoryName}</div>
            <div className="a4-title">
              <em>{settings.signatoryTitle}</em>
            </div>
          </div>
        </div>
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
