import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { todayYmd, weekdaysBetween } from '@/core/dates';
import { namesAll, requestMembers } from '@/core/requests';
import type { AbsenceRequest } from '@/core/types';
import { Button, Card } from '../components';
import { PageHeader } from '../App';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';

type CalFilter = 'all' | 'approved' | 'submitted';

/** Approved and waiting absences by date (yyyy-mm-dd). */
export function absencesByDate(requests: readonly AbsenceRequest[], filter: CalFilter): Map<string, AbsenceRequest[]> {
  const map = new Map<string, AbsenceRequest[]>();
  for (const r of requests) {
    if (r.status !== 'approved' && r.status !== 'submitted') continue;
    if (filter !== 'all' && r.status !== filter) continue;
    const dates = r.type === 'multi' ? weekdaysBetween(r.startDate, r.endDate) : r.date ? [r.date] : [];
    for (const d of dates) map.set(d, [...(map.get(d) ?? []), r]);
  }
  return map;
}

/** "[AM] Juan +2" — what a calendar badge says. */
export function eventLabel(r: AbsenceRequest): string {
  const prefix = r.type === 'half' ? (r.shift === 'afternoon' ? '[PM]' : '[AM]') : '[FULL]';
  const first = r.snapshot.name.split(' ')[0] ?? r.snapshot.name;
  const extra = requestMembers(r).length - 1;
  return `${prefix} ${first}${extra > 0 ? ` +${extra}` : ''}`;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Everyone's absences by month, for HR: a click opens the letter's review. */
export function CalendarScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<CalFilter>('all');

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const monthLabel = base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const today = todayYmd();

  const byDate = useMemo(() => absencesByDate(Object.values(app.db.requests), filter), [app.db.requests, filter]);

  return (
    <div className="page page--wide">
      <PageHeader
        title="Calendar"
        subtitle="Approved and waiting absences by day. Click one to open its review."
        actions={
          <div className="row">
            <select className="field__select" aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as CalFilter)}>
              <option value="all">Approved + waiting</option>
              <option value="approved">Approved only</option>
              <option value="submitted">Waiting only</option>
            </select>
            <Button variant="ghost" size="small" onClick={() => setOffset((o) => o - 1)}>
              Previous
            </Button>
            <strong className="cal-month">{monthLabel}</strong>
            <Button variant="ghost" size="small" onClick={() => setOffset((o) => o + 1)}>
              Next
            </Button>
            {offset !== 0 ? (
              <Button variant="link" size="small" onClick={() => setOffset(0)}>
                Today
              </Button>
            ) : null}
          </div>
        }
      />
      <Card>
        <div className="cal">
          {DOW.map((d) => (
            <div key={d} className="cal__dow">
              {d}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`e${i}`} className="cal__cell cal__cell--empty" />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const events = byDate.get(ymd) ?? [];
            return (
              <div key={ymd} className={`cal__cell${ymd === today ? ' cal__cell--today' : ''}`}>
                <span className="cal__num">{day}</span>
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`cal__event cal__event--${ev.status}`}
                    title={`${namesAll(ev)} · ${ev.reasonCategory} (${ev.status === 'submitted' ? 'waiting' : ev.status})`}
                    onClick={() => navigate(paths.review(ev.id))}
                  >
                    {eventLabel(ev)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
