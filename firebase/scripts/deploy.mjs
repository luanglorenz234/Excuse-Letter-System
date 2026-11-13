// `npm run deploy` here: the functions and the Firestore rules and indexes, to
// the live apg-letters project. Extra arguments go on to `firebase deploy`.
//
// Before deploying, the Firebase CLI loads the functions to see what they are,
// and gives up after 10 seconds. Loading Firebase's libraries can take longer
// than that on an office PC (about 6.5 s on the one this was set up on), so
// this gives it a minute. FUNCTIONS_DISCOVERY_TIMEOUT is in seconds.

import { spawnSync } from 'node:child_process';

const args = ['deploy', '--project', 'apg-letters', '--only', 'functions,firestore', ...process.argv.slice(2)];
const env = { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '60' };

const run = spawnSync('firebase', args, { stdio: 'inherit', shell: true, env });
process.exit(run.status ?? 1);
