import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { memberComments } from '@/core/comments';
import { formatShortDate } from '@/core/dates';
import { canGuestEdit, findByAccessCode, formatAccessCode, namesAll, withdrawRequest } from '@/core/requests';
import { Button, Card, EmptyState, Notice } from '../components';
import { LetterComments } from '../letter/LetterComments';
import { printLetter } from '../letter/print';
import { PageHeader } from '../App';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';
import { StatusPill, datesText, typeText } from '../shared';

/**
 * An intern's letter, opened with its code (interns have no account): its
 * status, HR's comments highlighted on the letter, and what they can do next.
 */
export function InternLetterScreen() {
  const { code = '' } = useParams();
  const app = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const fresh = Boolean((location.state as { fresh?: boolean } | null)?.fresh);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const req = findByAccessCode(app.db, code);

  if (!req?.accessCode) {
    return (
      <div className="page">
        <EmptyState
          title="No letter with that code"
          action={
            <Button variant="primary" onClick={() => navigate(paths.home)}>
              Back to the start
            </Button>
          }
        >
          Check the code and try again. HR can look it up for you if you lost it.
        </EmptyState>
      </div>
    );
  }

  const comments = memberComments(req);
  const shownCode = formatAccessCode(req.accessCode);
  const withdraw = async () => {
    setConfirmWithdraw(false);
    await app.run(withdrawRequest(app.db, null, req.id, new Date()));
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

      {fresh ? (
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
                {canGuestEdit(req) ? (
                  <Button variant="primary" onClick={() => navigate(paths.internEdit(req.accessCode ?? ''))}>
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
                      <Button variant="ghost" onClick={() => void withdraw()}>
                        Yes, withdraw
                      </Button>
                      <Button variant="link" onClick={() => setConfirmWithdraw(false)}>
                        Keep it
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirmWithdraw(true)}>
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
