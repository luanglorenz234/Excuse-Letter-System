import type { Platform } from '@/platform';
import type { Backend } from './types';

export type { Backend, HrAccount, HrCall, PublicCall, Reply, SampleAccount } from './types';

/**
 * Which server the app talks to. The installed app: the live project.
 * Development: the local stand-in (`npm run dev`), or the Firebase emulator
 * on this PC (`npm run dev:emulator`, VITE_BACKEND=emulator in .env.emulator).
 * Each is loaded only where it is used.
 */
export async function chooseBackend(platform: Platform): Promise<Backend> {
  const wanted = import.meta.env.VITE_BACKEND ?? (import.meta.env.DEV ? 'local' : 'live');
  if (wanted === 'emulator') {
    const { createFirebaseBackend, EMULATOR } = await import('./firebase');
    return createFirebaseBackend(EMULATOR);
  }
  if (wanted === 'local' && import.meta.env.DEV) {
    const { createLocalBackend } = await import('./local');
    return createLocalBackend(platform);
  }
  const { createFirebaseBackend, LIVE } = await import('./firebase');
  return createFirebaseBackend(LIVE);
}
