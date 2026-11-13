/** Every screen's path. Screens link with these, never with string literals. */
export const paths = {
  home: '/',
  /** HR only: every account on the Firebase project is HR. */
  signIn: '/sign-in',
  /** Interns and employees, no account: file a letter. */
  form: '/form',
  /** Open a letter with its code. */
  letter: (code: string) => `/letter/${encodeURIComponent(code)}`,
  letterEdit: (code: string) => `/letter/${encodeURIComponent(code)}/edit`,
  calendar: '/calendar',
  queue: '/queue',
  review: (id: string) => `/review/${encodeURIComponent(id)}`,
  settings: '/settings',
} as const;
