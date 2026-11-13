// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createLocalBackend } from '@/backend/local';
import { createMemoryPlatform } from '@/platform/memory';
import { App } from './App';
import { AppStateProvider } from './state/AppState';

// The whole app in a simulated browser, on the local stand-in: the same
// server handlers the Cloud Functions run, on the sample data. One person
// files a letter with no account, HR who isn't the officer reviews it, and the
// HR officer approves it.

const REASON = 'I have a meeting with our department chairperson for our capstone project on the said date.';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom draws nothing: the signature pad and the letter's scaling do without.
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  window.scrollTo = () => {};
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function start() {
  const platform = createMemoryPlatform();
  const backend = createLocalBackend(platform);
  render(
    <AppStateProvider platform={platform} backend={backend}>
      <App />
    </AppStateProvider>,
  );
  return { platform, backend };
}

async function signIn(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.click(await screen.findByRole('button', { name: 'HR sign-in' }));
  await user.type(screen.getByLabelText(/^Email/), email);
  await user.type(screen.getByLabelText(/^Password/), 'HrTest#2026');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

async function signOut(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByText('Leave of absence request');
}

describe('a letter from the form to approval', () => {
  it('is filed without an account, reviewed by HR, and approved only by the HR officer', async () => {
    const user = userEvent.setup();
    start();

    // An employee fills in the one form, with no account.
    await user.click(await screen.findByRole('button', { name: 'Absence form' }));
    await user.click(screen.getByRole('radio', { name: 'Employee' }));
    await user.type(screen.getByLabelText(/^Full name/), 'Paolo Reyes');
    await user.type(screen.getByLabelText(/^Position/), 'Operations Associate');
    await user.type(screen.getByLabelText(/^Department/), 'Operations');
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: REASON } });
    await user.click(screen.getByRole('radio', { name: 'Wet signature (by hand)' }));
    await user.click(screen.getByRole('radio', { name: 'Hand in the paper copy' }));
    await user.click(screen.getByRole('button', { name: 'Sign and submit' }));

    // They get a code, the only way back to the letter.
    const sent = await screen.findByText('Sent to HR');
    const code = within(sent.closest('[role="status"], .notice') as HTMLElement).getAllByText(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/)[0]?.textContent ?? '';
    expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(screen.getByText('Waiting for HR. You can still change it, or withdraw it.')).toBeTruthy();

    // Later, they open it again by its code, typed any way.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.type(await screen.findByLabelText(/^Already sent one/), code.toLowerCase().replace('-', ' '));
    await user.click(screen.getByRole('button', { name: 'Check my letter' }));
    expect(await screen.findByText(`Letter ${code}`)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // HR who isn't the officer: asked for a name once, can't approve, can't change Settings.
    await signIn(user, 'ana@apg-letters.test');
    await user.type(await screen.findByLabelText(/^Full name/), 'Ana Cruz');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click((await screen.findAllByText('Paolo Reyes'))[0] as HTMLElement);
    expect(await screen.findByText(/Only the HR officer \(chico@apg-letters\.test\) approves and signs letters/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mark paper copy received' }));
    expect(await screen.findByText('Paper copy marked as received. You can now approve.')).toBeTruthy();
    await user.click(screen.getByRole('link', { name: /Settings/ }));
    expect(await screen.findByText(/Only the HR officer \(chico@apg-letters\.test\) can change these settings/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save letter settings' })).toBeNull();
    await signOut(user);

    // The HR officer approves; the letter gets the next reference number.
    await signIn(user, 'chico@apg-letters.test');
    await user.click((await screen.findAllByText('Paolo Reyes'))[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Approved. Reference no. APG-EL-2026-0044 assigned and HR signature added.')).toBeTruthy();
    await signOut(user);

    // The filer sees it approved, with its reference number.
    await user.type(await screen.findByLabelText(/^Already sent one/), code);
    await user.click(screen.getByRole('button', { name: 'Check my letter' }));
    expect(await screen.findByText('Reference APG-EL-2026-0044')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Print / save PDF' })).toBeTruthy();
  }, 30_000);

  it('says so when a code matches no letter', async () => {
    const user = userEvent.setup();
    start();
    await user.type(await screen.findByLabelText(/^Already sent one/), 'ZZZ-ZZZ');
    await user.click(screen.getByRole('button', { name: 'Check my letter' }));
    await waitFor(() => expect(screen.getByText('No letter has that code. Check it and try again, or ask HR.')).toBeTruthy());
  });
});
