import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { openComments, type NewComment } from '@/core/comments';
import { formatShortDate } from '@/core/dates';
import { notedByFor, signsInApp } from '@/core/letter';
import { filerKey, formatAccessCode, isAwaitingPaperCopy, isGroupRequest, namesShort, requestMembers, type Decision } from '@/core/requests';
import type { AbsenceRequest, Db } from '@/core/types';
import { Button, Card, EmptyState, Notice, Pill } from '../components';
import { safeImageSrc } from '../letter/Letter';
import { LetterComments } from '../letter/LetterComments';
import { printLetter } from '../letter/print';
import { PageHeader } from '../App';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';
import { PhotoDialog, StatusPill, datesText, typeText } from '../shared';

const METHOD_LABEL: Record<AbsenceRequest['signatureMethod'], string> = {
  digital: 'Digital signature',
  'wet-upload': 'Hand-signed · photo uploaded',
  'wet-paper': 'Hand-signed · paper copy to HR',
};

/** Earlier signatures from the same person, to compare against this one. */
export function referenceSignatures(db: Db, req: AbsenceRequest): { src: string; label: string }[] {
  const refs: { src: string; label: string }[] = [];
  const seen = new Set<string>();
  if (req.signatureMethod === 'digital') seen.add(safeImageSrc(req.internSignature));
  const add = (src: string | undefined, label: string) => {
    const safe = safeImageSrc(src);
    if (safe && !seen.has(safe)) {
      seen.add(safe);
      refs.push({ src: safe, label });
    }
  };
  // The same person's earlier letters, by name (nobody filing has an account).
  const who = filerKey(req);
  Object.values(db.requests)
    .filter((r) => filerKey(r) === who && r.id !== req.id && r.status !== 'draft' && r.signatureMethod === 'digital')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
    .forEach((r) => {
      if (refs.length < 4) add(r.internSignature, `Request ${formatShortDate(r.submittedAt ?? r.createdAt)}`);
    });
  return refs;
}

export function ReviewScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const req = app.db.requests[id];
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState<Decision | 'paper' | 'resolve' | null>(null);
  const [photo, setPhoto] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const others = useMemo(() => {
    if (!req) return [];
    const who = filerKey(req);
    return Object.values(app.db.requests)
      .filter((r) => filerKey(r) === who && r.id !== req.id && r.status !== 'draft')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [app.db.requests, req]);

  if (!req) {
    return (
      <div className="page">
        <EmptyState
          title="Request not found"
          action={
            <Button variant="primary" onClick={() => navigate(paths.queue)}>
              Back to the queue
            </Button>
          }
        >
          It may have been removed, or the sample data was reset.
        </EmptyState>
      </div>
    );
  }

  const waiting = req.status === 'submitted';
  const paperPending = isAwaitingPaperCopy(req);
  const open = openComments(req);
  const openSent = open.filter((c) => c.sentAt).length;
  const resolvedCount = req.comments.length - open.length;
  const shownComments = showResolved ? req.comments : open;
  // On the employee letter the CEO and Marketing sign the printed copy by hand.
  const signByHand = notedByFor(req, app.db.settings.letter).filter((n) => !signsInApp(n, app.db.settings.letter));

  const commentHandlers = waiting
    ? {
        onAdd: (comment: NewComment) => app.act({ action: 'addComment', id: req.id, comment }),
        onEdit: (commentId: string, body: string) => app.act({ action: 'editComment', id: req.id, commentId, body }),
        onDelete: (commentId: string) => app.act({ action: 'deleteComment', id: req.id, commentId }),
        onResolve: (commentId: string, resolved: boolean) => app.act({ action: 'resolveComments', id: req.id, ids: [commentId], resolved }),
      }
    : {};

  const resolveAll = async () => {
    setBusy('resolve');
    await app.act({ action: 'resolveComments', id: req.id, ids: null, resolved: true });
    setBusy(null);
  };

  const decide = async (decision: Decision) => {
    setBusy(decision);
    const saved = await app.act({ action: 'decide', id: req.id, decision, remarks });
    setBusy(null);
    if (saved) {
      setRemarks('');
      if (decision !== 'approved') navigate(paths.queue);
    }
  };

  const paper = async (received: boolean) => {
    setBusy('paper');
    await app.act({ action: 'paper', id: req.id, received });
    setBusy(null);
  };

  return (
    <div className="page page--wide">
      <PageHeader
        title={namesShort(req)}
        subtitle={`${req.refNo ?? req.id} · ${datesText(req)} · ${typeText(req)}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(paths.queue)}>
              Back to queue
            </Button>
            {req.status === 'approved' ? (
              <Button variant="primary" onClick={() => void printLetter(req, app.db.settings.letter)}>
                Print / save PDF
              </Button>
            ) : null}
          </>
        }
      />

      <div className="workspace workspace--review">
        <div className="stack">
          {waiting ? (
            <Card
              title="Decision"
              description="Approving adds the reference number and your signature. To ask for changes, comment on the letter (select words on it) and return it."
            >
              <div className="stack">
                {paperPending ? (
                  <Notice tone="warn" title="Waiting for the paper copy">
                    Mark the hand-signed paper copy as received before approving.
                  </Notice>
                ) : null}
                {open.length > 0 ? (
                  <Notice
                    tone="info"
                    title={`${open.length} open comment${open.length === 1 ? '' : 's'} on the letter`}
                    action={
                      openSent > 0 ? (
                        <Button size="small" variant="ghost" busy={busy === 'resolve'} disabled={busy !== null} onClick={() => void resolveAll()}>
                          Resolve all
                        </Button>
                      ) : undefined
                    }
                  >
                    {openSent < open.length ? 'Return the letter to send your new comments, or delete them to approve instead. ' : null}
                    {openSent > 0 ? 'Resolve the ones the member has fixed before approving.' : null}
                  </Notice>
                ) : null}
                <div className="field">
                  <label className="field__label" htmlFor="remarks">
                    Remarks
                  </label>
                  <textarea
                    id="remarks"
                    className="field__textarea"
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional when approving, or when returning with comments on the letter."
                  />
                </div>
                {app.isOfficer ? null : (
                  <Notice tone="info">
                    {app.db.settings.letter.hrOfficerEmail
                      ? `Only the HR officer (${app.db.settings.letter.hrOfficerEmail}) approves and signs letters. You can comment, return or decline.`
                      : 'No HR officer is named yet: name one in Settings. Only that account approves and signs letters.'}
                  </Notice>
                )}
                <div className="row">
                  {app.isOfficer ? (
                    <Button variant="primary" busy={busy === 'approved'} disabled={busy !== null || paperPending || open.length > 0} onClick={() => void decide('approved')}>
                      Approve
                    </Button>
                  ) : null}
                  <Button variant="ghost" busy={busy === 'returned'} disabled={busy !== null} onClick={() => void decide('returned')}>
                    Return for revision
                  </Button>
                  <Button variant="ghost" busy={busy === 'declined'} disabled={busy !== null} onClick={() => void decide('declined')}>
                    Decline
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Decision">
              <div className="stack stack--tight">
                <div>
                  <StatusPill status={req.status} />
                </div>
                {req.review ? (
                  <p>
                    "{req.review.remarks}" <span className="muted">— {req.review.byName}, {formatShortDate(req.review.at)}</span>
                  </p>
                ) : null}
                {req.status === 'approved' && signByHand.length > 0 ? (
                  <Notice tone="info" title="Still to sign by hand">
                    Print this letter for {signByHand.map((n) => n.title || n.name).join(' and ')} to sign. Only your signature is added in the app.
                  </Notice>
                ) : null}
              </div>
            </Card>
          )}

          <SignatureCheck request={req} db={app.db} busy={busy === 'paper'} onPaper={(v) => void paper(v)} onPhoto={() => setPhoto(true)} />

          <Card title="Details">
            <dl className="details">
              <Detail label="Name" value={req.snapshot.name} />
              <Detail
                label="Filed by"
                value={req.accessCode ? `Intern form (no account) · code ${formatAccessCode(req.accessCode)}` : req.memberType === 'employee' ? 'Employee account' : 'Intern account'}
              />
              {req.snapshot.internId ? <Detail label="ID number" value={req.snapshot.internId} /> : null}
              {req.memberType === 'employee' ? <Detail label="Position" value={req.snapshot.position} /> : null}
              <Detail label="Department" value={req.snapshot.department || '—'} />
              <Detail label="Reason" value={req.reasonCategory} />
              <Detail label="Date(s)" value={datesText(req)} />
              <Detail label="Absence" value={`${typeText(req)}${req.timeRange ? ` · ${req.timeRange}` : ''}`} />
            </dl>
            {isGroupRequest(req) ? (
              <div className="stack stack--tight" style={{ marginTop: 'var(--space-8)' }}>
                <strong>Group request · {requestMembers(req).length} people</strong>
                <ul className="plain-list">
                  {requestMembers(req).map((m, i) => (
                    <li key={`${m.uid ?? 'x'}-${i}`}>
                      {m.name}
                      {m.position ? ` · ${m.position}` : ''}
                      {m.department ? ` · ${m.department}` : ''}
                      {m.internId ? ` · ${m.internId}` : ''}
                      {m.isFiler ? <em className="muted"> (filed the request)</em> : m.uid || req.accessCode ? null : <em className="muted"> (no account)</em>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card title={`Other requests by ${req.snapshot.name.split(' ')[0] ?? req.snapshot.name} (${others.length})`}>
            {others.length === 0 ? (
              <p className="muted">No other requests from this member.</p>
            ) : (
              <ul className="plain-list">
                {others.map((o) => (
                  <li key={o.id} className="row row--between">
                    <span>
                      <strong>{datesText(o)}</strong> <span className="muted">· {o.reasonCategory}</span>
                    </span>
                    <StatusPill status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="History">
            <ol className="timeline">
              {req.history.map((h, i) => (
                <li key={i}>
                  <div className="row">
                    <StatusPill status={h.status} />
                    <span className="muted small">{formatShortDate(h.at)}</span>
                  </div>
                  <strong className="small">{h.byName}</strong>
                  <span className="muted small">{h.remarks}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="preview" aria-label="Letter">
          <div className="preview__bar">
            <span>{req.refNo ? `Reference ${req.refNo}` : 'Not yet approved'}</span>
            <span>Template v{req.templateVersion}</span>
          </div>
          <div className="preview__stage">
            <LetterComments
              request={req}
              settings={app.db.settings.letter}
              comments={shownComments}
              viewer="hr"
              emptyText={resolvedCount > 0 ? 'No open comments.' : undefined}
              toolbar={
                req.comments.length > 0 || waiting ? (
                  <span className="row row--tight small">
                    <strong>Comments</strong>
                    <span className="muted">
                      {open.length} open{resolvedCount > 0 ? ` · ${resolvedCount} resolved` : ''}
                    </span>
                    {resolvedCount > 0 ? (
                      <Button size="small" variant="link" onClick={() => setShowResolved((v) => !v)}>
                        {showResolved ? 'Hide resolved' : 'Show resolved'}
                      </Button>
                    ) : null}
                  </span>
                ) : null
              }
              {...commentHandlers}
            />
          </div>
        </div>
      </div>

      {photo ? <PhotoDialog src={req.wetCopyImage} title="Hand-signed letter" onClose={() => setPhoto(false)} /> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="cell-sub">{label}</dt>
      <dd className="cell-main">{value || '—'}</dd>
    </div>
  );
}

function SignatureCheck({ request: req, db, busy, onPaper, onPhoto }: { request: AbsenceRequest; db: Db; busy: boolean; onPaper: (received: boolean) => void; onPhoto: () => void }) {
  const refs = referenceSignatures(db, req);
  const waiting = req.status === 'submitted';
  let main;
  if (req.signatureMethod === 'digital') {
    const src = safeImageSrc(req.internSignature);
    main = src ? (
      <>
        <div className="sig-compare">
          <div className="sig-compare__item sig-compare__item--current">
            <img src={src} alt="Signature on this request" />
            This request
          </div>
        </div>
      </>
    ) : (
      <Notice tone="danger">No signature on this request.</Notice>
    );
  } else if (req.signatureMethod === 'wet-upload') {
    const src = safeImageSrc(req.wetCopyImage);
    main = src ? (
      <>
        <button type="button" className="photo-button" onClick={onPhoto} aria-label="View the photo full size">
          <img src={src} alt="Photo of the hand-signed letter" className="wet-photo" />
        </button>
        <p className="muted small">Click the photo to see it full size.</p>
      </>
    ) : (
      <Notice tone="danger">No photo was uploaded.</Notice>
    );
  } else {
    const received = req.paperCopy?.status === 'received';
    main = (
      <div className="row">
        {received ? (
          <>
            <Pill tone="ok" dot>
              Paper copy received
            </Pill>
            <span className="muted small">
              by {req.paperCopy?.receivedByName ?? 'HR'} on {formatShortDate(req.paperCopy?.receivedAt)}
            </span>
            {waiting ? (
              <Button size="small" variant="ghost" busy={busy} onClick={() => onPaper(false)}>
                Undo
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Pill tone="warn" dot>
              Waiting for paper copy
            </Pill>
            {waiting ? (
              <Button size="small" variant="primary" busy={busy} onClick={() => onPaper(true)}>
                Mark paper copy received
              </Button>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <Card title="Signature check" description={METHOD_LABEL[req.signatureMethod]}>
      <div className="stack">
        {main}
        {refs.length > 0 ? (
          <div className="stack stack--tight">
            <span className="muted small">Earlier signatures from this person, to compare:</span>
            <div className="sig-compare">
              {refs.map((r) => (
                <div key={r.src} className="sig-compare__item">
                  <img src={r.src} alt={r.label} />
                  {r.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted small">No earlier signatures from this person to compare with.</p>
        )}
      </div>
    </Card>
  );
}
