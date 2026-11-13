import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canEdit, includesUser, lastSnapshot } from '@/core/requests';
import type { AbsenceRequest } from '@/core/types';
import { Button, Card, EmptyState, Notice } from '../components';
import { safeImageSrc } from '../letter/Letter';
import { PageHeader } from '../App';
import { useApp, useUser } from '../state/AppState';
import { paths } from '../state/paths';
import { LetterDialog, StatusPill, datesText, typeText } from '../shared';

export function DashboardScreen() {
  const app = useApp();
  const user = useUser();
  const navigate = useNavigate();
  const [viewing, setViewing] = useState<AbsenceRequest | null>(null);

  const mine = useMemo(
    () =>
      Object.values(app.db.requests)
        .filter((r) => includesUser(r, user.uid) && (r.uid === user.uid || r.status !== 'draft'))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [app.db.requests, user.uid],
  );
  const count = (s: AbsenceRequest['status']) => mine.filter((r) => r.status === s).length;
  const returned = mine.filter((r) => r.status === 'returned' && r.uid === user.uid);
  const sig = safeImageSrc(user.savedSignature);
  const last = lastSnapshot(app.db, user.uid);

  return (
    <div className="page">
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0] ?? user.name}`}
        subtitle="Your absence letters at a glance."
        actions={
          <Button variant="primary" onClick={() => navigate(paths.newRequest)}>
            New request
          </Button>
        }
      />

      {returned.length > 0 ? (
        <Notice tone="warn" title={`${returned.length} letter${returned.length > 1 ? 's' : ''} returned for revision`}>
          HR asked for changes, with comments highlighted on the letter. Open <strong>My requests</strong> and choose Revise.
        </Notice>
      ) : null}

      <div className="stat-grid">
        {(
          [
            ['Approved', count('approved')],
            ['Waiting for HR', count('submitted')],
            ['Returned', count('returned')],
            ['Drafts', count('draft')],
          ] as const
        ).map(([label, value]) => (
          <Card key={label} padding="tight">
            <div className="stat">
              <span className="stat__value tabular">{value}</span>
              <span className="stat__label">{label}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid-2">
        <Card
          title="Recent requests"
          actions={
            <Button size="small" variant="ghost" onClick={() => navigate(paths.myRequests)}>
              View all ({mine.length})
            </Button>
          }
        >
          {mine.length === 0 ? (
            <EmptyState title="No requests yet" headingLevel={3}>
              File your first absence letter with New request.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date(s)</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {mine.slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="cell-main">{datesText(r)}</div>
                        <div className="cell-sub">
                          {typeText(r)} · {r.reasonCategory}
                        </div>
                      </td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>
                        <div className="row row--end">
                          <Button size="small" variant="ghost" onClick={() => setViewing(r)}>
                            View
                          </Button>
                          {canEdit(r, user) ? (
                            <Button size="small" variant="ghost" onClick={() => navigate(paths.edit(r.id))}>
                              {r.status === 'submitted' ? 'Edit' : 'Revise'}
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
        </Card>

        <Card title="My profile" description="Your position and department are typed on each letter; the next one starts from your last.">
          <dl className="stack stack--tight">
            <div>
              <dt className="cell-sub">Name</dt>
              <dd className="cell-main">{user.name}</dd>
            </div>
            <div>
              <dt className="cell-sub">Email</dt>
              <dd>{user.email || '—'}</dd>
            </div>
            <div>
              <dt className="cell-sub">Position on your last letter</dt>
              <dd>{last?.position || user.position || '—'}</dd>
            </div>
            <div>
              <dt className="cell-sub">Department on your last letter</dt>
              <dd>{last?.department || user.department || '—'}</dd>
            </div>
            <div>
              <dt className="cell-sub">Saved signature</dt>
              <dd>{sig ? <img src={sig} alt="Your saved signature" style={{ height: 56, background: '#fff', borderRadius: 4 }} /> : 'None yet'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {viewing ? <LetterDialog request={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}
