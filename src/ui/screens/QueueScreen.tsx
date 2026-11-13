import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestsCsv } from '@/core/csv';
import { todayYmd } from '@/core/dates';
import { isGroupRequest, namesAll, namesShort, requestMembers } from '@/core/requests';
import { REASON_CATEGORIES, type AbsenceRequest, type RequestStatus } from '@/core/types';
import { Button, Card, EmptyState } from '../components';
import { PageHeader } from '../App';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';
import { PaperTag, StatusPill, datesText, typeText } from '../shared';

/** Every request but drafts, waiting ones first; and the same rows the CSV export writes. */
export function queueRows(all: readonly AbsenceRequest[], status: string, reason: string, dept: string): AbsenceRequest[] {
  return all
    .filter((r) => r.status !== 'draft')
    .filter((r) => (status === 'all' || r.status === status) && (reason === 'all' || r.reasonCategory === reason) && (dept === 'all' || r.snapshot.department === dept))
    .sort((a, b) => Number(b.status === 'submitted') - Number(a.status === 'submitted') || b.updatedAt.localeCompare(a.updatedAt));
}

const STATUSES: readonly ('all' | RequestStatus)[] = ['all', 'submitted', 'approved', 'returned', 'declined', 'withdrawn'];

export function QueueScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [reason, setReason] = useState('all');
  const [dept, setDept] = useState('all');

  const all = useMemo(() => Object.values(app.db.requests).filter((r) => r.status !== 'draft'), [app.db.requests]);
  const rows = useMemo(() => queueRows(all, status, reason, dept), [all, status, reason, dept]);
  const departments = useMemo(() => [...new Set(all.map((r) => r.snapshot.department).filter(Boolean))].sort(), [all]);
  const count = (s: RequestStatus) => all.filter((r) => r.status === s).length;

  const exportCsv = async () => {
    if (rows.length === 0) {
      app.notify('No requests match the current filters.', 'warn');
      return;
    }
    try {
      const where = await app.platform.saveTextFile(`absence-requests-${todayYmd()}.csv`, requestsCsv(rows));
      const open = app.platform.openExportFolder;
      app.notify(
        <span>
          Saved {rows.length} row{rows.length === 1 ? '' : 's'} to {where}.{' '}
          {open ? (
            <Button size="small" variant="link" onClick={() => void open()}>
              Open folder
            </Button>
          ) : null}
        </span>,
      );
    } catch (err) {
      app.notify(err instanceof Error ? err.message : String(err), 'danger');
    }
  };

  return (
    <div className="page page--wide">
      <PageHeader
        title="Review queue"
        subtitle="Waiting requests come first. Open one to review the letter beside its details."
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(paths.calendar)}>
              Calendar
            </Button>
            <Button variant="ghost" onClick={() => void exportCsv()}>
              Export CSV ({rows.length})
            </Button>
          </>
        }
      />

      <div className="stat-grid">
        {(
          [
            ['Waiting for review', count('submitted')],
            ['Approved', count('approved')],
            ['Returned', count('returned')],
            ['Declined', count('declined')],
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

      <Card>
        <div className="stack">
          <div className="filters">
            <Filter id="q-status" label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => [s, s === 'all' ? 'All statuses' : s === 'submitted' ? 'Waiting' : s[0]!.toUpperCase() + s.slice(1)])} />
            <Filter id="q-reason" label="Reason" value={reason} onChange={setReason} options={[['all', 'All reasons'], ...REASON_CATEGORIES.map((c) => [c, c] as const)]} />
            <Filter id="q-dept" label="Department" value={dept} onChange={setDept} options={[['all', 'All departments'], ...departments.map((d) => [d, d] as const)]} />
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No requests" headingLevel={3}>
              Nothing matches these filters.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Who</th>
                    <th>Date(s)</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`is-clickable${r.status === 'withdrawn' ? ' is-faded' : ''}`}
                      onClick={() => navigate(paths.review(r.id))}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(paths.review(r.id))}
                      tabIndex={0}
                    >
                      <td>
                        <div className="cell-main">{r.refNo ?? 'Pending'}</div>
                        <div className="cell-sub">{r.id}</div>
                      </td>
                      <td>
                        <div className="cell-main">{namesShort(r)}</div>
                        <div className="cell-sub" title={namesAll(r)}>
                          {[r.memberType === 'employee' ? 'Employee' : 'Intern', isGroupRequest(r) ? `group of ${requestMembers(r).length}` : r.snapshot.position || r.snapshot.department]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Filter({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[] }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="field__select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
