import type { SampleAccount } from './backend/types';

/**
 * The local stand-in's HR accounts (`npm run dev`, no Firebase): made-up, and
 * checked inside the page, so never put a real password here. Real HR
 * accounts are made in the Firebase console for the apg-letters project.
 *
 * The sample data names chico@apg-letters.test as the HR officer, who
 * approves; ana@apg-letters.test is HR who can comment, return and decline,
 * and has no name yet, so the first sign-in asks for it.
 */
export const LOCAL_HR_ACCOUNTS: readonly (SampleAccount & { readonly uid: string; readonly name: string })[] = [
  { uid: 'hr-chico', email: 'chico@apg-letters.test', password: 'HrTest#2026', name: 'Ms. Jean Ashley Chico', label: 'HR officer (approves)' },
  { uid: 'hr-ana', email: 'ana@apg-letters.test', password: 'HrTest#2026', name: '', label: 'HR' },
];
