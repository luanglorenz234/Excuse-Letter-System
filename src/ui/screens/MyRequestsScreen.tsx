import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canEdit, includesUser, isGroupRequest, namesAll, requestMembers, withdrawRequest } from '@/core/requests';
import type { AbsenceRequest, RequestStatus } from '@/core/types';
import { Button, Card, EmptyState } from '../components';
import { printLetter } from '../letter/print';
import { PageHeader } from '../App';
import { useApp, useUser } from '../state/AppState';
import { paths } from '../state/paths';
import { LetterDialog, PaperTag, StatusPill, datesText, typeText } from '../shared';

const FILTERS: readonly ('all' | RequestStatus)[] = ['all', 'submitted', 'approved', 'returned', 'declined', 'draft', 'withdrawn'];
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  all: 'All',
  submitted: 'Waiting',
  approved: 'Approved',
  returned: 'Returned',
  declined: 'Declined',
  draft: 'Drafts',
  withdrawn: 'Withdrawn',
};

/** Requests I filed, plus group letters someone else filed with me on them (view only). */
export function MyRequestsScreen() {
  const app = useApp();
  const user = useUser();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [viewing, setViewing] = useState<AbsenceRequest | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);

  const mine = useMemo(
    () =>
      Object.values(app.db.requests)
        .filter((r) => includesUser(r, user.uid) && (r.uid === user.uid || r.status !== 'draft'))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [app.db.requests, user.uid],
  );
  const shown = filter === 'all' ? mine : mine.filter((r) => r.status === filter);

  const withdraw = async (id: string) => {
    setConfirmWithdraw(null);
    await app.run(withdrawRequest(app.db, user, id, new Date()));
  };

  return (
    <div className="page">
      <PageHeader
        title="My requests"
        subtitle="Edit a pending or returned letter, withdraw one still waiting, or print an approved one. Group letters others filed with you show here too."
        actions={
          <Button variant="primary" onClick={() => navigate(paths.newRequest)}>
            New request
          </Button>
        }
      />
      <Card>
        <div className="stack">
          <div className="segmented" role="radiogroup" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={filter === f} className="segmented__option" onClick={() => setFilter(f)}>
                {FILTER_LABEL[f]}
                {f === 'all' ? ` (${mine.length})` : ''}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <EmptyState title="Nothing here" headingLevel={3}>
              No requests match this filter.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Date(s)</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>HR remarks</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className={r.status === 'withdrawn' ? 'is-faded' : undefined}>
                      <td>
                        <div className="cell-main">{r.refNo ?? '—'}</div>
                        <div className="cell-sub">{r.id}</div>
                        {isGroupRequest(r) ? <div className="cell-sub" title={namesAll(r)}>Group of {requestMembers(r).length}</div> : null}
                        {r.uid !== user.uid ? <div className="cell-sub">Filed by {r.snapshot.name}</div> : null}
                      </td>
                      <td>
                        <div className="cell-main">{datesText(r)}</div>
                        <div className="cell-sub">{typeText(r)}</div>
                      </td>
                      <td>{r.reasonCategory}</td>
                      <td>
                        <StatusPill status={r.status} />
                        <PaperTag request={r} />
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        {r.review?.remarks ? (
                          <>
                            <div>"{r.review.remarks}"</div>
                            <div className="cell-sub">— {r.review.byName}</div>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="row row--end">
                          <Button size="small" variant="ghost" onClick={() => setViewing(r)}>
                            View letter
                          </Button>
                          {canEdit(r, user) ? (
                            <Button size="small" variant="ghost" onClick={() => navigate(paths.edit(r.id))}>
                              {r.status === 'submitted' ? 'Edit' : 'Revise'}
                            </Button>
                          ) : null}
                          {r.status === 'submitted' && r.uid === user.uid ? (
                            confirmWithdraw === r.id ? (
                              <>
                                <Button size="small" variant="ghost" onClick={() => void withdraw(r.id)}>
                                  Yes, withdraw
                                </Button>
                                <Button size="small" variant="link" onClick={() => setConfirmWithdraw(null)}>
                                  Keep
                                </Button>
                              </>
                            ) : (
                              <Button size="small" variant="ghost" onClick={() => setConfirmWithdraw(r.id)}>
                                Withdraw
                              </Button>
                            )
                          ) : null}
                          {r.status === 'approved' ? (
                            <Button size="small" variant="ghost" onClick={() => void printLetter(r, app.db.settings.letter)}>
                              Print / PDF
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
      {viewing ? (
        <LetterDialog
          request={viewing}
          onClose={() => setViewing(null)}
          onPrint={viewing.status === 'approved' ? () => void printLetter(viewing, app.db.settings.letter) : undefined}
        />
      ) : null}
    </div>
  );
}
