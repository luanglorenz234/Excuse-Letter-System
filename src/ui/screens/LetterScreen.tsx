import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { memberComments } from '@/core/comments';
import { formatShortDate } from '@/core/dates';
import { canRevise, formatAccessCode, namesAll } from '@/core/requests';
import type { AbsenceRequest } from '@/core/types';
import type { LetterReply } from '@/server/handlers';
import { Button, Card, EmptyState, Notice } from '../components';
import { LetterComments } from '../letter/LetterComments';
import { printLetter } from '../letter/print';
import { PageHeader } from '../App';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';
import { StatusPill, datesText, typeText } from '../shared';

/** What the screen that sent here already has: the letter, and whether it was just sent. */
export interface LetterState {
  readonly letter?: AbsenceRequest;
  readonly fresh?: boolean;
}

type Load = { state: 'loading' } | { state: 'ready'; letter: AbsenceRequest } | { state: 'missing' } | { state: 'failed'; error: string };

/** The letter for `code`, fetched from the server unless the screen before passed it along. */
export function useLetter(code: string, passed: AbsenceRequest | undefined): [Load, (letter: AbsenceRequest) => void, () => void] {
  const { call } = useApp();
  const [load, setLoad] = useState<Load>(() => (passed ? { state: 'ready', letter: passed } : { state: 'loading' }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (passed && attempt === 0) return undefined;
    let cancelled = false;
    void call<LetterReply>({ action: 'open', code }).then((reply) => {
      if (cancelled) return;
      if (reply.ok) setLoad({ state: 'ready', letter: reply.value.letter });
      else setLoad(reply.notFound ? { state: 'missing' } : { state: 'failed', error: reply.error });
    });
    return () => {
      cancelled = true;
    };
  }, [code, attempt, call, passed]);
  return [load, (letter) => setLoad({ state: 'ready', letter }), () => setAttempt((n) => n + 1)];
}

/** A letter's loading, missing and failed states. Null when it is ready. */
export function LetterPlaceholder({ load, retry }: { load: Load; retry: () => void }) {
  const navigate = useNavigate();
  if (load.state === 'ready') return null;
  if (load.state === 'loading') {
    return (
      <div className="page" aria-busy="true">
        <p className="muted">Opening the letter…</p>
      </div>
    );
  }
  return (
    <div className="page">
      <EmptyState
        title={load.state === 'missing' ? 'No letter with that code' : "The letter couldn't be opened"}
        action={
          <div className="row">
            {load.state === 'failed' ? (
              <Button variant="primary" onClick={retry}>
                Try again
              </Button>
            ) : null}
            <Button variant={load.state === 'failed' ? 'ghost' : 'primary'} onClick={() => navigate(paths.home)}>
              Back to the start
            </Button>
          </div>
        }
      >
        {load.state === 'missing' ? 'Check the code and try again. HR can look it up for you if you lost it.' : load.error}
      </EmptyState>
    </div>
  );
}

/**
 * A letter opened with its code (nobody filing has an account): its status,
 * HR's comments highlighted on the letter, and what they can do next.
 */
export function LetterScreen() {
  const { code = '' } = useParams();
  const app = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const passed = (location.state as LetterState | null) ?? {};
  const [load, setLetter, retry] = useLetter(code, passed.letter);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [busy, setBusy] = useState(false);

  if (load.state !== 'ready') return <LetterPlaceholder load={load} retry={retry} />;
  const req = load.letter;
  const comments = memberComments(req);
  const shownCode = formatAccessCode(req.accessCode ?? code);

  const withdraw = async () => {
    setConfirmWithdraw(false);
    setBusy(true);
    const reply = await app.call<LetterReply>({ action: 'withdraw', code: req.accessCode ?? code });
    setBusy(false);
    if (!reply.ok) {
      app.notify(reply.error, 'warn');
      return;
    }
    setLetter(reply.value.letter);
    app.notify(reply.message);
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(shownCode);
      app.notify('Code copied.');
    } catch {
      app.notify('Couldn’t copy. Write the code down instead.', 'warn');
    }
  };

  return (
    <div className="page page--wide">
      <PageHeader
        title={`Letter ${shownCode}`}
        subtitle={`${namesAll(req)} · ${datesText(req)} · ${typeText(req)}`}
        actions={
          <Button variant="ghost" onClick={() => navigate(paths.home)}>
            Done
          </Button>
        }
      />

      {passed.fresh ? (
        <Notice tone="ok" title="Sent to HR" live>
          Your letter code is <strong className="code-chip">{shownCode}</strong>. Write it down or copy it: enter it on the start screen under “Check my letter” to see
          HR’s decision or comments.{' '}
          <Button size="small" variant="link" onClick={() => void copyCode()}>
            Copy code
          </Button>
        </Notice>
      ) : null}

      <div className="workspace">
        <div className="stack">
          <Card title="Status">
            <div className="stack">
              <div className="row">
                <StatusPill status={req.status} />
                {req.refNo ? <span className="muted small">Reference {req.refNo}</span> : null}
              </div>
              {req.status === 'returned' ? (
                <Notice tone="warn" title="HR asked for changes">
                  {comments.length > 0
                    ? `${comments.length} comment${comments.length === 1 ? '' : 's'} on the letter, highlighted on the right. Revise the letter and send it again.`
                    : 'Revise the letter and send it again.'}
                </Notice>
              ) : null}
              {req.status === 'submitted' ? <p className="muted">Waiting for HR. You can still change it, or withdraw it.</p> : null}
              {req.status === 'approved' ? <p className="muted">Approved. Print it or save it as a PDF for your records.</p> : null}
              {req.status === 'declined' ? <p className="muted">HR declined this letter.</p> : null}
              {req.status === 'withdrawn' ? <p className="muted">You withdrew this letter. Its dates are free again.</p> : null}
              {req.review?.remarks && !/^Returned with \d+ comments?/.test(req.review.remarks) ? (
                <p>
                  “{req.review.remarks}” <span className="muted">— {req.review.byName}, {formatShortDate(req.review.at)}</span>
                </p>
              ) : null}
              <div className="row">
                {canRevise(req) ? (
                  <Button variant="primary" onClick={() => navigate(paths.letterEdit(req.accessCode ?? code), { state: { letter: req } satisfies LetterState })}>
                    {req.status === 'returned' ? 'Revise and resubmit' : 'Edit letter'}
                  </Button>
                ) : null}
                {req.status === 'approved' ? (
                  <Button variant="primary" onClick={() => void printLetter(req, app.db.settings.letter)}>
                    Print / save PDF
                  </Button>
                ) : null}
                {req.status === 'submitted' ? (
                  confirmWithdraw ? (
                    <>
                      <Button variant="ghost" busy={busy} onClick={() => void withdraw()}>
                        Yes, withdraw
                      </Button>
                      <Button variant="link" onClick={() => setConfirmWithdraw(false)}>
                        Keep it
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" busy={busy} onClick={() => setConfirmWithdraw(true)}>
                      Withdraw
                    </Button>
                  )
                ) : null}
              </div>
            </div>
          </Card>
          <Card title="Your letter code" description="The only way back to this letter. Keep it private: anyone with it can open the letter.">
            <div className="row">
              <strong className="code-chip code-chip--large">{shownCode}</strong>
              <Button size="small" variant="ghost" onClick={() => void copyCode()}>
                Copy
              </Button>
            </div>
          </Card>
        </div>

        <div className="preview" aria-label="Letter">
          <div className="preview__bar">
            <span>{comments.length > 0 ? 'Yellow marks HR’s comments · click one to see it' : 'Your letter'}</span>
          </div>
          <div className="preview__stage">
            <LetterComments request={req} settings={app.db.settings.letter} comments={comments} viewer="member" />
          </div>
        </div>
      </div>
    </div>
  );
}
