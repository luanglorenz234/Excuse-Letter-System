import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/tokens.css';
import './theme/base.css';
import { setPlatform, type Platform } from './platform';
import { App } from './ui/App';
import { AppStateProvider } from './ui/state/AppState';

/**
 * Tauri's platform inside the desktop app (data in SQLite). In a plain browser
 * during `npm run dev`, the browser platform (data in localStorage), so the
 * screens can be tried without building Rust. Each is loaded only where it is
 * used, so the browser never loads Tauri's modules.
 */
async function choosePlatform(): Promise<Platform | null> {
  if ('__TAURI_INTERNALS__' in window) {
    const { createTauriPlatform } = await import('./platform/tauri');
    return createTauriPlatform();
  }
  if (import.meta.env.DEV) {
    const { createBrowserPlatform } = await import('./platform/browser');
    return createBrowserPlatform();
  }
  return null;
}

async function start(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) throw new Error('index.html has no #root element.');
  const platform = await choosePlatform();
  if (!platform) {
    const message = document.createElement('p');
    message.className = 'outside-the-app';
    message.textContent = 'Open APG Excuse Letters from the desktop app.';
    root.replaceChildren(message);
    return;
  }
  setPlatform(platform);
  createRoot(root).render(
    <StrictMode>
      <AppStateProvider platform={platform}>
        <App />
      </AppStateProvider>
    </StrictMode>,
  );
}

void start();
