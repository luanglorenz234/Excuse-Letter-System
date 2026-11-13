/**
 * The way from the screens to the server. Three versions, the same handlers
 * behind each (src/server/handlers.ts):
 *
 *   live       the apg-letters Firebase project: the installed app
 *   emulator   Firebase's emulator on this PC: `npm run dev:emulator`
 *   local      no Firebase at all, the handlers run in the page and keep the
 *              sample data in this browser: `npm run dev`
 *
 * Development never reaches the live project.
 */

import type { HrCall, PublicCall, Reply } from '@/server/handlers';

export type { HrCall, PublicCall, Reply } from '@/server/handlers';

/** The HR account signed in. */
export interface HrAccount {
  readonly uid: string;
  readonly email: string;
  /** The account's display name; '' until they give it on their first sign-in. */
  readonly name: string;
}

/** A test account of the local stand-in. Never a real one. */
export interface SampleAccount {
  readonly email: string;
  readonly password: string;
  readonly label: string;
}

export interface Backend {
  readonly kind: 'live' | 'emulator' | 'local';
  /** Where the letters are, in words, for the test bar. */
  readonly label: string;

  /** The absence form and letter codes: no sign-in. A refusal or a lost connection is a Reply too. */
  publicCall<T>(call: PublicCall): Promise<Reply<T>>;
  /** HR's actions, as the account signed in. */
  hrCall<T>(call: HrCall): Promise<Reply<T>>;

  /** Called with the account, or null, once the kept sign-in has been read, then on each change. Returns a stop. */
  watch(changed: (account: HrAccount | null) => void): () => void;
  /** Rejects with an Error whose message can be shown as it is. */
  signIn(email: string, password: string): Promise<HrAccount>;
  signOut(): Promise<void>;
  /** Sets the account's name, which goes on reviews and comments. */
  setName(name: string): Promise<HrAccount>;

  /** The local stand-in's sample data and test accounts; null elsewhere. */
  readonly sample: { readonly accounts: readonly SampleAccount[]; reset(): Promise<void> } | null;
}
