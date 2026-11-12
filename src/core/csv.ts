import { requestMembers } from './requests';
import type { AbsenceRequest } from './types';

function cell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/** The HR queue's rows as CSV. A group request lists every person, joined with "; ". */
export function requestsCsv(requests: readonly AbsenceRequest[]): string {
  const headers = ['RefNo', 'RequestID', 'MemberName', 'MemberID', 'Position', 'Department', 'GroupSize', 'Type', 'DateOrRange', 'Shift', 'ReasonCategory', 'Status', 'ReviewedBy', 'ReviewRemarks'];
  const rows = requests.map((r) => {
    const members = requestMembers(r);
    const join = (k: 'name' | 'internId' | 'position' | 'department') => members.map((m) => m[k]).join('; ');
    return [
      r.refNo ?? '',
      r.id,
      join('name'),
      join('internId'),
      join('position'),
      join('department'),
      members.length,
      r.type,
      r.type === 'multi' ? `${r.startDate ?? ''} to ${r.endDate ?? ''}` : r.date ?? '',
      r.shift ?? 'full',
      r.reasonCategory,
      r.status,
      r.review?.byName ?? '',
      r.review?.remarks ?? '',
    ];
  });
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}
