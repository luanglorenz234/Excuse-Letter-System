import { describe, expect, it } from 'vitest';
import { createMemoryPlatform } from '@/platform/memory';
import { forgetRecentLetter, readRecentLetters, rememberRecentLetter } from './recentLetters';

function sampleLetter(code: string, name: string, date = '2026-11-27') {
  return {
    accessCode: code,
    snapshot: { name, internId: '', position: '', department: 'IT' },
    type: 'full' as const,
    date,
    startDate: null,
    endDate: null,
    days: 1,
  };
}

describe('recentLetters', () => {
  it('remembers up to 5 recent letters newest-first, deduplicates, and forgets by code', () => {
    const platform = createMemoryPlatform();
    expect(readRecentLetters(platform)).toEqual([]);

    for (const [i, code] of ['AAA111', 'BBB222', 'CCC333', 'DDD444', 'EEE555', 'FFF666'].entries()) {
      rememberRecentLetter(platform, sampleLetter(code, `Person ${i + 1}`));
    }

    expect(readRecentLetters(platform).map((r) => r.code)).toEqual(['FFF666', 'EEE555', 'DDD444', 'CCC333', 'BBB222']);

    // Reopening an existing code bumps it to the front without duplicating it.
    rememberRecentLetter(platform, sampleLetter('ccc-333', 'Person 3 Updated'));
    expect(readRecentLetters(platform).map((r) => r.code)).toEqual(['CCC333', 'FFF666', 'EEE555', 'DDD444', 'BBB222']);
    expect(readRecentLetters(platform)[0]?.name).toBe('Person 3 Updated');

    forgetRecentLetter(platform, 'CCC-333');
    expect(readRecentLetters(platform).map((r) => r.code)).toEqual(['FFF666', 'EEE555', 'DDD444', 'BBB222']);
  });
});
