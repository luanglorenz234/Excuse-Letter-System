/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Which server: "local" (the stand-in, default in `npm run dev`), "emulator", or "live" (default in a build). See src/backend. */
  readonly VITE_BACKEND?: 'local' | 'emulator' | 'live';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
