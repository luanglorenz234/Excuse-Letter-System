import { CODE_LENGTH, normalizeAccessCode } from '@/core/requests';
import type { AbsenceRequest } from '@/core/types';
import type { Platform } from '@/platform';
import { datesText } from '../shared';

const KEY = 'apg-el-recent-letters';
const MAX_RECENT = 5;

export interface RecentLetter {
  readonly code: string;
  readonly name: string;
  readonly dates: string;
}

/** Reads the recent letter codes saved on this PC, newest first. */
export function readRecentLetters(platform: Pick<Platform, 'readLocal'>): RecentLetter[] {
  const raw = platform.readLocal(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: RecentLetter[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const code = typeof rec.code === 'string' ? normalizeAccessCode(rec.code) : '';
      const name = typeof rec.name === 'string' ? rec.name.trim() : '';
      const dates = typeof rec.dates === 'string' ? rec.dates.trim() : '';
      if (code.length !== CODE_LENGTH || seen.has(code)) continue;
      seen.add(code);
      out.push({ code, name, dates });
      if (out.length >= MAX_RECENT) break;
    }
    return out;
  } catch {
    return [];
  }
}

function writeRecent(platform: Pick<Platform, 'writeLocal'>, items: readonly RecentLetter[]): RecentLetter[] {
  const next = items.slice(0, MAX_RECENT);
  platform.writeLocal(KEY, next.length > 0 ? JSON.stringify(next) : null);
  return next;
}

/** Saves or bumps a letter to the top of this PC's recent list. */
export function rememberRecentLetter(
  platform: Pick<Platform, 'readLocal' | 'writeLocal'>,
  letter: Pick<AbsenceRequest, 'accessCode' | 'snapshot' | 'type' | 'date' | 'startDate' | 'endDate' | 'days'>,
): RecentLetter[] {
  const code = normalizeAccessCode(letter.accessCode ?? '');
  if (code.length !== CODE_LENGTH) return readRecentLetters(platform);
  const entry: RecentLetter = {
    code,
    name: letter.snapshot.name.trim(),
    dates: datesText(letter),
  };
  const rest = readRecentLetters(platform).filter((r) => r.code !== code);
  return writeRecent(platform, [entry, ...rest]);
}

/** Removes a letter code from this PC's recent list. */
export function forgetRecentLetter(platform: Pick<Platform, 'readLocal' | 'writeLocal'>, code: string): RecentLetter[] {
  const target = normalizeAccessCode(code);
  return writeRecent(
    platform,
    readRecentLetters(platform).filter((r) => r.code !== target),
  );
}
