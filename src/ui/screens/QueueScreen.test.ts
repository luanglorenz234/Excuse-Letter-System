import { describe, expect, it } from 'vitest';
import { seedDb } from '@/core/seed';
import { queueRows } from './QueueScreen';

describe('queueRows search', () => {
  const all = Object.values(seedDb().requests);

  it('matches by name, department, reference number, and hyphenated or plain letter code', () => {
    expect(queueRows(all, 'all', 'all', 'all', 'k7q-4mz').map((r) => r.accessCode)).toEqual(['K7Q4MZ']);
    expect(queueRows(all, 'all', 'all', 'all', 'k7q4mz').map((r) => r.accessCode)).toEqual(['K7Q4MZ']);
    const approved = all.find((r) => r.refNo);
    expect(approved?.refNo).toBeTruthy();
    expect(queueRows(all, 'all', 'all', 'all', approved!.refNo!).map((r) => r.id)).toEqual([approved!.id]);
    expect(queueRows(all, 'all', 'all', 'all', 'no-such-person-xyz')).toEqual([]);
  });
});
