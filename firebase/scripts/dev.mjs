// `npm run dev` here: run inside the emulator (firebase emulators:exec sets
// FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST), so it never reaches
// the live project. Makes two HR test accounts and names the HR officer, then
// keeps the emulator running until Ctrl+C. Start the app against it with
// `npm run dev:emulator` in the folder above.

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'demo-apg-letters' });

// The same made-up accounts as the app's local stand-in (src/config.ts). Never real ones.
const PASSWORD = 'HrTest#2026';
const ACCOUNTS = [
  { email: 'chico@apg-letters.test', displayName: 'Ms. Jean Ashley Chico', note: 'HR officer: approves and signs' },
  // No name: the first sign-in asks for it.
  { email: 'ana@apg-letters.test', displayName: undefined, note: 'HR: comments, returns, declines' },
];

for (const a of ACCOUNTS) {
  try {
    await getAuth(app).createUser({ email: a.email, password: PASSWORD, ...(a.displayName ? { displayName: a.displayName } : {}) });
  } catch (err) {
    if (err?.code !== 'auth/email-already-exists') throw err;
  }
}
await getFirestore(app).doc('config/settings').set({ letter: { formatVersion: 3, hrOfficerEmail: ACCOUNTS[0].email } }, { merge: true });

console.log('\nThe emulator is ready. HR test accounts (password ' + PASSWORD + '):');
for (const a of ACCOUNTS) console.log(`  ${a.email}  ${a.note}`);
console.log('\nRun `npm run dev:emulator` in the app folder. Ctrl+C here stops the emulator.\n');

// Until Ctrl+C.
await new Promise(() => {});
