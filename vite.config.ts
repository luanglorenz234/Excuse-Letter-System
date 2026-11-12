import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Same set-up as APG Post-It, so the two apps can be joined later.
// Tauri serves the built files. `npm run dev` also runs the app in a plain
// browser, where the browser platform (src/platform/browser.ts) keeps the data
// in localStorage instead of SQLite.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    // Rust's build output changes constantly and Windows locks files in it while
    // compiling; watching it crashes the dev server (EBUSY). Vite needs none of it.
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: { target: 'es2022', sourcemap: false },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
