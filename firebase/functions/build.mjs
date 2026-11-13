// Bundles the functions with the rules they share with the app (../../src/core
// and ../../src/server, imported as "@/..."), so the deploy uploads one file
// and the rules exist once. firebase-admin and firebase-functions stay outside:
// Cloud Functions installs them from package.json.

import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // "@/..." is resolved through tsconfig.json's paths.
  tsconfig: 'tsconfig.json',
  external: ['firebase-admin', 'firebase-admin/*', 'firebase-functions', 'firebase-functions/*'],
  sourcemap: true,
  logLevel: 'info',
});
