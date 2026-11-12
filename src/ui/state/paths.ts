/** Every screen's path. Screens link with these, never with string literals. */
export const paths = {
  home: '/',
  memberSignIn: '/sign-in/member',
  adminSignIn: '/sign-in/admin',
  dashboard: '/dashboard',
  newRequest: '/new',
  edit: (id: string) => `/edit/${encodeURIComponent(id)}`,
  myRequests: '/requests',
  calendar: '/calendar',
  queue: '/queue',
  review: (id: string) => `/review/${encodeURIComponent(id)}`,
  settings: '/settings',
} as const;
